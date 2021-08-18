import logging

import dateutil.parser
from datetime import datetime, timedelta
from django.conf import settings
from django.db.models import Max

from treeherder.model.models import Bugscache
from treeherder.utils.github import fetch_json

logger = logging.getLogger(__name__)


def fetch_intermittent_bugs(last_change_time, offset, limit):
    last_change_time_string = last_change_time.strftime('%Y-%m-%dT%H:%M:%SZ')
    url = settings.BZ_API_URL + '/rest/bug'
    params = {
        'keywords': 'intermittent-failure',
        'last_change_time': last_change_time,
        'include_fields': ','.join([
            'id',
            'summary',
            'status',
            'resolution',
            'cf_crash_signature',
            'keywords',
            'last_change_time',
            'whiteboard',
        ]),
        'offset': offset,
        'limit': limit,
    }
    response = fetch_json(url, params=params)
    return response.get('bugs', [])


class BzApiBugProcess:
    def run(self):
        bug_list = []

        year_ago = datetime.utcnow() - timedelta(days = 365)
        last_change_time_max = Bugscache.objects.all().aggregate(Max('modified'))['modified__max'] or None
        if last_change_time_max:
            last_change_time_max -= timedelta(minutes = 10)
        else:
            last_change_time_max = year_ago

        offset = 0
        limit = 500
        max_summary_length = Bugscache._meta.get_field('summary').max_length
        max_whiteboard_length = Bugscache._meta.get_field('whiteboard').max_length

        # Keep querying Bugzilla until there are no more results.
        while True:
            bug_results_chunk = fetch_intermittent_bugs(last_change_time_max, offset, limit)
            bug_list += bug_results_chunk
            if len(bug_results_chunk) < limit:
                break
            offset += limit

        insert_errors_observed = False
        if bug_list:
            Bugscache.objects.filter(modified__lt=year_ago).delete()

            for bug in bug_list:
                # we currently don't support timezones in treeherder, so
                # just ignore it when importing/updating the bug to avoid
                # a ValueError
                try:
                    Bugscache.objects.update_or_create(
                        id=bug['id'],
                        defaults={
                            'status': bug.get('status', ''),
                            'resolution': bug.get('resolution', ''),
                            'summary': bug.get('summary', '')[:max_summary_length],
                            'crash_signature': bug.get('cf_crash_signature', ''),
                            'keywords': ",".join(bug['keywords']),
                            'modified': dateutil.parser.parse(
                                bug['last_change_time'], ignoretz=True
                            ),
                            'whiteboard': bug.get('whiteboard', '')[:max_whiteboard_length],
                        },
                    )
                except Exception as e:
                    logger.error("error inserting bug '%s' into db: %s", bug, e)
                    insert_errors_observed = True
            if insert_errors_observed:
                logger.error("error inserting some bugs, bugscache is incomplete, bugs updated during run will be ingested again during the next run")
                # Move modification date of bugs inserted/updated during this
                # run back to attempt to ingest bug data which failed during
                # this insert/update in the next run.
                Bugscache.objects.filter(modified__gt=last_change_time_max).update(modified=last_change_time_max)
