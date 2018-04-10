import logging
import re

from django.core.cache import cache

from treeherder.config.settings import BUG_SUGGESTION_CACHE_TIMEOUT
from treeherder.model.models import (Bugscache,
                                     TextLogError)

logger = logging.getLogger(__name__)


LEAK_RE = re.compile(r'\d+ bytes leaked \((.+)\)$|leak at (.+)$')
CRASH_RE = re.compile(r'.+ application crashed \[@ (.+)\]$')
MOZHARNESS_RE = re.compile(
    r'^\d+:\d+:\d+[ ]+(?:DEBUG|INFO|WARNING|ERROR|CRITICAL|FATAL) - [ ]?'
)
REFTEST_RE = re.compile(r'\s+[=!]=\s+.*')
OUTPUT_RE = re.compile(r'^\s*(?:GECKO\(\d+\)|PID \d+)\s*$')


def get_error_summary(job):
    """
    Create a list of bug suggestions for a job
    """
    cache_key = 'error-summary-{}'.format(job.id)
    cached_error_summary = cache.get(cache_key)
    if cached_error_summary is not None:
        return cached_error_summary

    # don't cache or do anything if we have no text log errors to get
    # results for
    errors = TextLogError.objects.filter(step__job=job)
    if not errors:
        return []

    term_cache = {}
    error_summary = [bug_suggestions_line(err, term_cache) for err in errors]
    cache.set(cache_key, error_summary, BUG_SUGGESTION_CACHE_TIMEOUT)

    return error_summary


def bug_suggestions_line(err, term_cache=None):
    if term_cache is None:
        term_cache = {}
    # remove the mozharness prefix
    clean_line = get_mozharness_substring(err.line)
    search_terms = []
    # get a meaningful search term out of the error line
    search_term = get_error_search_term(clean_line)
    bugs = dict(open_recent=[], all_others=[])

    # collect open recent and all other bugs suggestions
    if search_term:
        search_terms.append(search_term)
        if search_term not in term_cache:
            term_cache[search_term] = Bugscache.search(search_term)
        bugs = term_cache[search_term]

    if not bugs or not (bugs['open_recent'] or
                        bugs['all_others']):
        # no suggestions, try to use
        # the crash signature as search term
        crash_signature = get_crash_signature(clean_line)
        if crash_signature:
            search_terms.append(crash_signature)
            if crash_signature not in term_cache:
                term_cache[crash_signature] = Bugscache.search(crash_signature)
            bugs = term_cache[crash_signature]

    # TODO: Rename 'search' to 'error_text' or similar, since that's
    # closer to what it actually represents (bug 1091060).
    return {
        "search": clean_line,
        "search_terms": search_terms,
        "bugs": bugs,
    }


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
        # If this is process output then discard the token with the PID
        if len(tokens) > 3 and OUTPUT_RE.match(tokens[0]):
            tokens = tokens[1:]
        # it's in the "FAILURE-TYPE | testNameOrFilePath | message" type format.
        test_name_or_path = tokens[1]
        message = tokens[2]
        # Leak failure messages are of the form:
        # leakcheck | .*\d+ bytes leaked (Object-1, Object-2, Object-3, ...)
        match = LEAK_RE.search(message)
        if match:
            search_term = match.group(1) if match.group(1) is not None else match.group(2)
        else:
            # For reftests, remove the reference path from the tokens as this is
            # not very unique
            test_name_or_path = REFTEST_RE.sub("", test_name_or_path)
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
        'mozalloc_abort(char const*)',
        'mozalloc_abort',
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

    return len(search_term) > 4 and search_term not in blacklist


def get_filtered_error_lines(job):
    return [item for item in get_error_summary(job) if
            is_helpful_search_term(item["search"])]
