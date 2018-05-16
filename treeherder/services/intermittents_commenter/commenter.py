import json
import logging
import re
import time
from collections import Counter
from datetime import (date,
                      datetime,
                      timedelta)

import requests
from django.conf import settings
from django.db.models import Count
from jinja2 import Template
from requests.exceptions import RequestException

from treeherder.model.models import (BugJobMap,
                                     Push)
from treeherder.webapp.api.utils import get_repository

# Min required failures per bug in order to post a comment
MIN_DAILY_THRESHOLD = 15
MIN_WEEKLY_THRESHOLD = 1
TOP_BUGS_THRESHOLD = 50

# Includes call-to-action message for priority threshold bugs
PRIORITY1_THRESHOLD = 75
PRIORITY2_THRESHOLD = 30

DISABLE_THRESHOLD = 150
DISABLE_DAYS = 21

# Change [stockwell needswork] to [stockwell unknown] when failure rate
# drops below 20 failures/week
UNKNOWN_THRESHOLD = 20

WHITEBOARD_DISABLE_RECOMMENDED = '[stockwell disable-recommended]'
WHITEBOARD_NEEDSWORK_OWNER = '[stockwell needswork:owner]'
WHITEBOARD_NEEDSWORK = '[stockwell needswork]'
WHITEBOARD_UNKNOWN = '[stockwell unknown]'

TRIAGE_PARAMS = {'include_fields': 'product,component,priority,whiteboard'}

logger = logging.getLogger(__name__)


class Commenter(object):
    """handles fetching, transforming and submitting bug comments based on
    daily or weekly thresholds and date range; if in test_mode, comments
    will be output to stdout rather than submitted to bugzilla"""

    def __init__(self, weekly_mode, test_mode):
        """booleans args are passed from the run_intermittents_commenter
           command based on --weekly_mode and --test_mode flags; if flags
           are omitted, default values for both are False"""

        self.weekly_mode = weekly_mode
        self.test_mode = test_mode

    def run(self):
        self.create_comments()

    def create_comments(self):
        """Posts a bug comment containing stats to each bug whose total number of
           occurrences (daily or weekly) meet the appropriate threshold."""

        startday, endday = self.calculate_date_strings(self.weekly_mode, 6)
        bug_stats = self.get_bug_stats(startday, endday)
        alt_startday, alt_endday = self.calculate_date_strings(True, DISABLE_DAYS)
        alt_bug_stats = self.get_bug_stats(alt_startday, alt_endday)
        test_run_count = self.get_test_runs(startday, endday)

        template = Template(self.open_file('comment.template', False))
        components = self.open_file('owner_triage_components.json', True)

        session = self.new_request()

        if self.weekly_mode:
            top_bugs = [bug[0] for bug in sorted(bug_stats.items(), key=lambda x: x[1]['total'],
                        reverse=True)][:TOP_BUGS_THRESHOLD]

        for bug_id, counts in bug_stats.iteritems():
            change_priority = None
            bug_info = None
            whiteboard = None
            priority = 0
            rank = None

            if self.weekly_mode and bug_id in top_bugs:
                rank = top_bugs.index(bug_id)+1

            # recommend disabling when more than 150 failures tracked over 21 days
            if alt_bug_stats[bug_id]['total'] >= DISABLE_THRESHOLD:
                bug_info = self.fetch_bug_details(session, TRIAGE_PARAMS, bug_id)
                if bug_info is not None:
                    whiteboard = bug_info['whiteboard']
                    if not self.check_whiteboard_status(whiteboard):
                        priority = 3
                        whiteboard = self.update_whiteboard(whiteboard, WHITEBOARD_DISABLE_RECOMMENDED)

            if priority == 0 and self.weekly_mode:
                if counts['total'] >= PRIORITY1_THRESHOLD:
                    priority = 1
                elif counts['total'] >= PRIORITY2_THRESHOLD:
                    priority = 2

            if priority == 2 or not self.weekly_mode:
                if not bug_info:
                    bug_info = self.fetch_bug_details(session, TRIAGE_PARAMS, bug_id)
                    if bug_info is not None:
                        whiteboard = bug_info['whiteboard']

                        if (([bug_info['product'], bug_info['component']] in components) and
                            not self.check_whiteboard_status(whiteboard)):

                            if bug_info['priority'] not in ['--', 'P1', 'P2', 'P3']:
                                change_priority = '--'

                            stockwell_text = re.search(r'\[stockwell (.+?)\]', whiteboard)
                            if stockwell_text is not None and stockwell_text.group() != WHITEBOARD_NEEDSWORK_OWNER:
                                whiteboard = self.update_whiteboard(whiteboard, WHITEBOARD_NEEDSWORK_OWNER)

            if self.weekly_mode and (counts['total'] < UNKNOWN_THRESHOLD):
                if not bug_info:
                    bug_info = self.fetch_bug_details(session, TRIAGE_PARAMS, bug_id)
                    if bug_info is not None:
                        whiteboard = bug_info['whiteboard']

                        stockwell_text = re.search(r'\[stockwell (.+?)\]', whiteboard)
                        if stockwell_text is not None and stockwell_text.group() == WHITEBOARD_NEEDSWORK:
                            whiteboard = self.update_whiteboard(whiteboard, WHITEBOARD_UNKNOWN)

            text = template.render(bug_id=bug_id,
                                   total=counts['total'],
                                   test_run_count=test_run_count,
                                   rank=rank,
                                   priority=priority,
                                   failure_rate=round(counts['total']/float(test_run_count), 3),
                                   repositories=counts['per_repository'],
                                   platforms=counts['per_platform'],
                                   startday=startday,
                                   endday=endday.split()[0],
                                   weekly_mode=self.weekly_mode)

            params = {'comment': {'body': text}}
            if whiteboard:
                params['whiteboard'] = whiteboard
            if change_priority:
                params['priority'] = change_priority

            if self.test_mode:
                print(text + '\n')
            else:
                self.submit_bug_comment(session, params, bug_id)
                # sleep between comment submissions to avoid overwhelming servers
                time.sleep(1)

    def open_file(self, filename, load):
        with open('treeherder/services/intermittents_commenter/{}'.format(filename), 'r') as myfile:
            if load:
                return json.load(myfile)
            else:
                return myfile.read()

    def calculate_date_strings(self, mode, numDays):
        """Returns a tuple of start (in YYYY-MM-DD format) and end date
           strings (in YYYY-MM-DD HH:MM:SS format for an inclusive day)."""

        yesterday = date.today() - timedelta(days=1)
        endday = datetime(yesterday.year, yesterday.month, yesterday.day, 23, 59, 59, 999)
        if mode:
            startday = yesterday - timedelta(days=numDays)
        else:
            # daily mode
            startday = yesterday

        return startday.isoformat(), endday.strftime('%Y-%m-%d %H:%M:%S.%f')

    def check_whiteboard_status(self, whiteboard):
        """Extracts stockwell text from a bug's whiteboard status to
           determine whether it matches specified stockwell text;
           returns a boolean"""

        stockwell_text = re.search(r'\[stockwell (.+?)\]', whiteboard)
        if stockwell_text is not None:
            text = stockwell_text.group(1).split(':')[0]
            if text == 'fixed' or text == 'disable-recommended' or text == 'infra' or text == 'disabled':
                return True
        return False

    def update_whiteboard(self, existing, new):
        return re.sub('\[stockwell.*?\]', new, existing)

    def new_request(self):
        session = requests.Session()
        # Use a custom HTTP adapter, so we can set a non-zero max_retries value.
        session.mount("https://", requests.adapters.HTTPAdapter(max_retries=3))
        session.headers = {
            'User-Agent': settings.TREEHERDER_USER_AGENT,
            'x-bugzilla-api-key': settings.BUGFILER_API_KEY,
            'Accept': 'application/json'
        }
        return session

    def fetch_bug_details(self, session, params, bug_id):
        """fetches bug metadata from bugzilla and returns an encoded
           dict if successful, otherwise returns None"""

        url = settings.BZ_API_URL + '/rest/bug/' + str(bug_id)
        try:
            response = session.get(url, headers=session.headers, params=params,
                                   timeout=settings.REQUESTS_TIMEOUT)
            response.raise_for_status()
        except RequestException as e:
            logger.warning('error fetching bugzilla metadata for bug {} because {}'.format(bug_id, e))
            return None

        # slow down: bmo server may refuse service if too many requests made too frequently
        time.sleep(0.5)
        data = response.json()
        if 'bugs' not in data:
            return None

        return {key.encode('UTF8'): value.encode('UTF8') for key, value in data['bugs'][0].iteritems()}

    def submit_bug_comment(self, session, params, bug_id):
        url = settings.BUGFILER_API_URL + '/rest/bug/' + str(bug_id)
        try:
            response = session.put(url, headers=session.headers, json=params,
                                   timeout=settings.REQUESTS_TIMEOUT)
            response.raise_for_status()
        except RequestException as e:
            logger.error('error posting comment to bugzilla for bug {} because {}'.format(bug_id, e))

    def get_test_runs(self, startday, endday):
        """returns an aggregate of pushes for specified date range and
           repository"""

        test_runs = (Push.objects.filter(repository_id__in=get_repository('all'),
                                         time__range=(startday, endday))
                                 .aggregate(Count('author')))
        return test_runs['author__count']

    def get_bug_stats(self, startday, endday):
        """get all intermittent failures per specified date range and repository,
           returning a dict of bug_id's with total, repository and platform totals
           if totals are greater than or equal to the threshold.
        eg:
        {
            "1206327": {
                "total": 5,
                "per_repository": {
                    "fx-team": 2,
                    "mozilla-inbound": 3
                },
                "per_platform": {
                    "osx-10-10": 4,
                    "b2g-emu-ics": 1
                }
            },
            ...
        }
        """

        threshold = MIN_WEEKLY_THRESHOLD if self.weekly_mode else MIN_DAILY_THRESHOLD
        bugs = (BugJobMap.failures.default(get_repository('all'), startday, endday)
                                  .values('job__repository__name', 'job__machine_platform__platform',
                                          'bug_id'))

        bug_map = dict()
        for bug in bugs:
            platform = bug['job__machine_platform__platform']
            repo = bug['job__repository__name']
            bug_id = bug['bug_id']
            if bug_id in bug_map:
                bug_map[bug_id]['total'] += 1
                bug_map[bug_id]['per_platform'][platform] += 1
                bug_map[bug_id]['per_repository'][repo] += 1
            else:
                bug_map[bug_id] = {}
                bug_map[bug_id]['total'] = 1
                bug_map[bug_id]['per_platform'] = Counter([platform])
                bug_map[bug_id]['per_repository'] = Counter([repo])

        return {key: value for key, value in bug_map.iteritems() if value['total'] >= threshold}
