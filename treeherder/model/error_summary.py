import json
import logging
import re

from django.conf import settings
from django.core.urlresolvers import reverse

logger = logging.getLogger(__name__)


LEAK_RE = re.compile(r'\d+ bytes leaked \((.+)\)$')
CRASH_RE = re.compile(r'.+ application crashed \[@ (.+)\]$')
MOZHARNESS_RE = re.compile(
    r'^\d+:\d+:\d+[ ]+(?:DEBUG|INFO|WARNING|ERROR|CRITICAL|FATAL) - [ ]?'
)


def get_error_summary(all_errors):
    """
    Transform the error lines into the artifact format.

    Add bug suggestions if they are found.
    """
    error_summary = []
    bugscache_uri = '{0}{1}'.format(
        settings.API_HOSTNAME,
        reverse("bugscache-list")
    )
    terms_requested = {}

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
        error_summary.append({
            "search": clean_line,
            "search_terms": search_terms,
            "bugs": bugs
        })

    return error_summary


def get_mozharness_substring(line):
    return MOZHARNESS_RE.sub('', line).strip()


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
        'leakcheck',
        'ImportError: No module named pygtk',
        '# TBPL FAILURE #'

    ]

    return len(search_term) > 4 and not (search_term in blacklist)


def get_bugs_for_search_term(search, base_uri):
    """
    Fetch the base_uri endpoint filtering on search and status.
    Status must be either 'open' or 'closed'
    """
    from treeherder.etl.common import fetch_json

    params = {
        'search': search
    }
    return fetch_json(base_uri, params=params)


def get_artifacts_that_need_bug_suggestions(artifact_list):
    """
    Return a list of ``text_log_summary`` that don't have ``Bug suggestions``
    """

    bs_guid_list = [x['job_guid'] for x in artifact_list if
                    x['name'] == 'Bug suggestions']

    tls_list = [x for x in artifact_list if
                x['name'] == 'text_log_summary' and
                x['job_guid'] not in bs_guid_list]
    return tls_list


def get_error_summary_artifacts(artifact_list):
    """
    Create bug suggestions artifact(s) for any text_log_summary artifacts.

    ``artifact_list`` here is a list of artifacts that may contain one or more
        ``text_log_artifact`` objects.  If it does, we extract the error lines
        from it.  If there ARE error lines, then we generate the
        ``bug suggestions`` artifacts and return them.
    """

    bug_suggestion_artifacts = []

    for artifact in artifact_list:
        # this is the only artifact name eligible to trigger generation of bug
        # suggestions.
        if artifact['name'] != 'text_log_summary':
            continue

        all_errors = get_all_errors(artifact)
        bug_suggestion_artifacts.append({
            "job_guid": artifact['job_guid'],
            "name": 'Bug suggestions',
            "type": 'json',
            "blob": json.dumps(get_error_summary(all_errors))
        })

    return bug_suggestion_artifacts


def get_all_errors(artifact):
    """Extract the error lines from an artifact's blob field"""

    artifact_blob = json.loads(artifact['blob'])
    if isinstance(artifact_blob, dict):
        return artifact_blob.get('step_data', {}).get('all_errors', [])


def load_error_summary(project, artifacts):
    """Load new bug suggestions artifacts if we generate them."""
    from treeherder.model.derived import ArtifactsModel

    bsa = get_error_summary_artifacts(artifacts)
    if bsa:
        with ArtifactsModel(project) as artifacts_model:
            artifacts_model.load_job_artifacts(bsa)
