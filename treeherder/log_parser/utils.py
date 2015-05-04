# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import re
import urllib
import urllib2
import logging
import time

import simplejson as json
from django.conf import settings
from django.core.urlresolvers import reverse

from treeherder.log_parser.artifactbuildercollection import \
    ArtifactBuilderCollection
from treeherder.log_parser.artifactbuilders import MozlogArtifactBuilder

from treeherder.client import TreeherderArtifactCollection, TreeherderRequest
from treeherder.etl.oauth_utils import OAuthCredentials

logger = logging.getLogger(__name__)


def is_helpful_search_term(search_term):
    # Search terms that will match too many bug summaries
    # and so not result in useful suggestions.
    search_term = search_term.strip()

    blacklist = [
        'automation.py',
        'remoteautomation.py',
        'Shutdown',
        'undefined',
        'Main app process exited normally',
        'Traceback (most recent call last):',
        'Return code: 0',
        'Return code: 1',
        'Return code: 2',
        'Return code: 9',
        'Return code: 10',
        'Exiting 1',
        'Exiting 9',
        'CrashingThread(void *)',
        'libSystem.B.dylib + 0xd7a',
        'linux-gate.so + 0x424',
        'TypeError: content is null',
        'leakcheck'
    ]

    return len(search_term) > 4 and not (search_term in blacklist)


LEAK_RE = re.compile(r'\d+ bytes leaked \((.+)\)$')
CRASH_RE = re.compile(r'.+ application crashed \[@ (.+)\]$')


def get_error_search_term(error_line):
    """
    retrieves bug suggestions from bugscache using search_term
    in a full_text search.
    """
    if not error_line:
        return None

    # This is strongly inspired by
    # https://hg.mozilla.org/webtools/tbpl/file/tip/php/inc/AnnotatedSummaryGenerator.php#l73

    tokens = error_line.split(" | ")
    search_term = None

    if len(tokens) >= 3:
        # it's in the "FAILURE-TYPE | testNameOrFilePath | message" type format.
        test_name_or_path = tokens[1]
        message = tokens[2]

        # Leak failure messages are of the form:
        # leakcheck | .*\d+ bytes leaked (Object-1, Object-2, Object-3, ...)
        match = LEAK_RE.search(message)
        if match:
            search_term = match.group(1)
        else:
            for splitter in ("/", "\\"):
                # if this is a path, we are interested in the last part
                test_name_or_path = test_name_or_path.split(splitter)[-1]
            search_term = test_name_or_path

    # If the failure line was not in the pipe symbol delimited format or the search term
    # will likely return too many (or irrelevant) results (eg: too short or matches terms
    # on the blacklist), then we fall back to searching for the entire failure line if
    # it is suitable.
    if not (search_term and is_helpful_search_term(search_term)):
        if is_helpful_search_term(error_line):
            search_term = error_line
        else:
            search_term = None

    # Searching for extremely long search terms is undesirable, since:
    # a) Bugzilla's max summary length is 256 characters, and once "Intermittent "
    # and platform/suite information is prefixed, there are even fewer characters
    # left for us to use for the failure string against which we need to match.
    # b) For long search terms, the additional length does little to prevent against
    # false positives, but means we're more susceptible to false negatives due to
    # run-to-run variances in the error messages (eg paths, process IDs).
    if search_term:
        search_term = search_term[:100]

    return search_term


def get_crash_signature(error_line):
    """
    Detect if the error_line contains a crash signature
    and return it if it's a helpful search term
    """
    search_term = None
    match = CRASH_RE.match(error_line)
    if match and is_helpful_search_term(match.group(1)):
        search_term = match.group(1)
    return search_term


def get_bugs_for_search_term(search, base_uri):
    """
    Fetch the base_uri endpoint filtering on search and status.
    Status must be either 'open' or 'closed'
    """
    from treeherder.etl.common import get_remote_content

    params = {
        'search': search
    }
    query_string = urllib.urlencode(params)
    url = '{0}?{1}'.format(
        base_uri,
        query_string
    )
    return get_remote_content(url)

mozharness_pattern = re.compile(
    r'^\d+:\d+:\d+[ ]+(?:DEBUG|INFO|WARNING|ERROR|CRITICAL|FATAL) - [ ]?'
)


def get_mozharness_substring(line):
    return mozharness_pattern.sub('', line).strip()


def is_parsed(job_log_url):
    # if parse_status is not available, consider it pending
    parse_status = job_log_url.get("parse_status", "pending")
    return parse_status == "parsed"


def extract_text_log_artifacts(log_url, job_guid, check_errors):
    """Generate a summary artifact for the raw text log."""
    bug_suggestions = []
    bugscache_uri = '{0}{1}'.format(
        settings.API_HOSTNAME,
        reverse("bugscache-list")
    )
    terms_requested = {}

    # parse a log given its url
    artifact_bc = ArtifactBuilderCollection(log_url,
                                            check_errors=check_errors)
    artifact_bc.parse()

    artifact_list = []
    for name, artifact in artifact_bc.artifacts.items():
        artifact_list.append((job_guid, name, 'json',
                              json.dumps(artifact)))
    if check_errors:
        all_errors = artifact_bc.artifacts\
            .get('text_log_summary', {})\
            .get('step_data', {})\
            .get('all_errors', [])

        for err in all_errors:
            # remove the mozharness prefix
            clean_line = get_mozharness_substring(err['line'])
            search_terms = []
            # get a meaningful search term out of the error line
            search_term = get_error_search_term(clean_line)
            bugs = dict(open_recent=[], all_others=[])

            # collect open recent and all other bugs suggestions
            if search_term:
                search_terms.append(search_term)
                if search_term not in terms_requested:
                    # retrieve the list of suggestions from the api
                    bugs = get_bugs_for_search_term(
                        search_term,
                        bugscache_uri
                    )
                    terms_requested[search_term] = bugs
                else:
                    bugs = terms_requested[search_term]

            if not bugs or not (bugs['open_recent'] or
                                bugs['all_others']):
                # no suggestions, try to use
                # the crash signature as search term
                crash_signature = get_crash_signature(clean_line)
                if crash_signature:
                    search_terms.append(crash_signature)
                    if crash_signature not in terms_requested:
                        bugs = get_bugs_for_search_term(
                            crash_signature,
                            bugscache_uri
                        )
                        terms_requested[crash_signature] = bugs
                    else:
                        bugs = terms_requested[crash_signature]

            # TODO: Rename 'search' to 'error_text' or similar, since that's
            # closer to what it actually represents (bug 1091060).
            bug_suggestions.append({
                "search": clean_line,
                "search_terms": search_terms,
                "bugs": bugs
            })

    artifact_list.append(
        (
            job_guid,
            'Bug suggestions',
            'json',
            json.dumps(bug_suggestions)
        )
    )

    return artifact_list


def extract_json_log_artifacts(log_url, job_guid, check_errors):
    """ Generate a summary artifact for the mozlog json log. """
    logger.debug("Parsing JSON log at url: {0}".format(log_url))

    ab = MozlogArtifactBuilder(log_url)
    ab.parse_log()

    return [(job_guid, ab.name, "json", json.dumps(ab.get_artifact()))]


def post_log_artifacts(project,
                       job_guid,
                       job_log_url,
                       retry_task,
                       extract_artifacts_cb,
                       check_errors=False):
    """Post a list of artifacts to a job."""
    def _retry(e):
        # Initially retry after 1 minute, then for each subsequent retry
        # lengthen the retry time by another minute.
        retry_task.retry(exc=e, countdown=(1 + retry_task.request.retries) * 60)
        # .retry() raises a RetryTaskError exception,
        # so nothing after this function will be executed

    log_description = "%s %s (%s)" % (project, job_guid, job_log_url['url'])
    logger.debug("Downloading/parsing log for %s", log_description)

    credentials = OAuthCredentials.get_credentials(project)
    req = TreeherderRequest(
        protocol=settings.TREEHERDER_REQUEST_PROTOCOL,
        host=settings.TREEHERDER_REQUEST_HOST,
        project=project,
        oauth_key=credentials.get('consumer_key', None),
        oauth_secret=credentials.get('consumer_secret', None),
    )

    try:
        artifact_list = extract_artifacts_cb(job_log_url['url'],
                                             job_guid, check_errors)
    except Exception as e:
        update_parse_status(req, job_log_url, 'failed')
        if isinstance(e, urllib2.HTTPError) and e.code in (403, 404):
            logger.debug("Unable to retrieve log for %s: %s", log_description, e)
            return
        logger.error("Failed to download/parse log for %s: %s", log_description, e)
        _retry(e)

    # store the artifacts generated
    tac = TreeherderArtifactCollection()
    for artifact in artifact_list:
        ta = tac.get_artifact({
            "job_guid": artifact[0],
            "name": artifact[1],
            "type": artifact[2],
            "blob": artifact[3]
        })
        tac.add(ta)

    try:
        req.post(tac)
        update_parse_status(req, job_log_url, 'parsed')
        logger.debug("Finished posting artifact for %s %s", project, job_guid)
    except Exception as e:
        logger.error("Failed to upload parsed artifact for %s: %s", log_description, e)
        _retry(e)


def update_parse_status(req, job_log_url, parse_status):
    update_endpoint = 'job-log-url/{}/update_parse_status'.format(job_log_url['id'])
    current_timestamp = time.time()
    req.send(
        update_endpoint,
        method='POST',
        data={
            'parse_status': parse_status,
            'parse_timestamp': current_timestamp
        }
    )
