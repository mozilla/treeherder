import re
import urllib

from django.conf import settings


def is_helpful_search_term(search_term):
    # Search terms that will match too many bug summaries
    # and so not result in useful suggestions.
    search_term = search_term.strip()

    blacklist = [
        'automation.py',
        'remoteautomation.py',
        'Shutdown',
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


leak_re = re.compile('\d+ bytes leaked \((.+)\)$')
crash_re = re.compile('application crashed \[@ (.+)\]$')


def get_error_search_term(error_line):
    """
    retrieves bug suggestions from bugscache using search_term
    in a full_text search.
    """
    if not error_line:
        return ""

    # this is STRONGLY inspired to
    # https://hg.mozilla.org/webtools/tbpl/file/tip/php/inc/AnnotatedSummaryGenerator.php#l73

    tokens = error_line.split(" | ")
    search_term = None

    if len(tokens) >= 3:
        # it's in the "FAILURE-TYPE | testNameOrFilePath | message" type format.
        test_name_or_path = tokens[1]
        message = tokens[2]

        # Leak failure messages are of the form:
        # leakcheck | .*leaked \d+ bytes (Object-1, Object-2, Object-3, ...)
        match = leak_re.match(message)
        if match:
            search_term = match.group(0)
        else:
            for splitter in ("/", "\\"):
                # if this is a path, we are interested in the last part
                test_name_or_path = test_name_or_path.split(splitter)[-1]
            search_term = test_name_or_path

    # If the failure line was not in the pipe symbol delimited format or the search term
    # will likely return too many (or irrelevant) results (eg: too short or matches terms
    # on the blacklist), then we fall back to searching for the entire failure line.
    if not (search_term and is_helpful_search_term(search_term)) \
       and is_helpful_search_term(error_line):

        search_term = error_line

    return search_term or error_line


def get_crash_signature(error_line):
    """
    Detect if the error_line contains a crash signature
    and return it if it's a helpful search term
    """
    search_term = None
    match = crash_re.match(error_line)
    if match and is_helpful_search_term(match.group(0)):
        search_term = match.group(0)
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
    '^\d+:\d+:\d+[ ]+(?:DEBUG|INFO|WARNING|ERROR|CRITICAL|FATAL) - [ ]?'
)

def get_mozharness_substring(line):
    return mozharness_pattern.sub('', line).strip()
