import datetime
import logging
import re
import newrelic.agent

from django.core.cache import cache

from treeherder.model.models import Bugscache, TextLogError

logger = logging.getLogger(__name__)


# the amount of time we cache bug suggestion lookups (to speed up loading the
# bug suggestions panel for recently finished jobs)
BUG_SUGGESTION_CACHE_TIMEOUT = 86400
LINE_CACHE_TIMEOUT_DAYS = 21
LINE_CACHE_TIMEOUT = 86400 * LINE_CACHE_TIMEOUT_DAYS

LEAK_RE = re.compile(r'\d+ bytes leaked \((.+)\)$|leak at (.+)$')
CRASH_RE = re.compile(r'.+ application crashed \[@ (.+)\] \|.+')
MOZHARNESS_RE = re.compile(r'^\d+:\d+:\d+[ ]+(?:DEBUG|INFO|WARNING|ERROR|CRITICAL|FATAL) - [ ]?')
PROCESS_ID_RE = re.compile(r"(?:PID \d+|GECKO\(\d+\)) \| +")
REFTEST_RE = re.compile(r'\s+[=!]=\s+.*')
PREFIX_PATTERN = r'^(TEST-UNEXPECTED-\S+|PROCESS-CRASH)\s+\|\s+'


def get_error_summary(job, queryset=None):
    """
    Create a list of bug suggestions for a job.
    TextLogError queryset can be passed directly to avoid firing a DB query.

    Caches the results if there are any.
    """
    cache_key = 'error-summary-{}'.format(job.id)
    cached_error_summary = cache.get(cache_key)
    if cached_error_summary is not None:
        return cached_error_summary

    # add support for error line caching
    line_cache_key = 'error_lines'
    line_cache = cache.get(line_cache_key)
    if line_cache is None:
        line_cache = {str(job.submit_time.date()): {}}
    else:
        dates = list(line_cache.keys())
        dates.sort()
        for d in dates:
            dTime = datetime.datetime.strptime(d, '%Y-%m-%d')
            if dTime <= (job.submit_time - datetime.timedelta(days=LINE_CACHE_TIMEOUT_DAYS)):
                del line_cache[d]
            else:
                break

    if queryset is None:
        queryset = TextLogError.objects.filter(job=job)
    # don't cache or do anything if we have no text log errors to get results for
    if not queryset:
        return []

    # cache terms generated from error line to save excessive querying
    term_cache = {}

    error_summary = []
    # Future suggestion, set this to queryset[:10] to reduce calls to bug_suggestions_line
    for err in queryset:
        summary, line_cache = bug_suggestions_line(
            err,
            project=job.repository,
            logdate=job.submit_time,
            term_cache=term_cache,
            line_cache=line_cache,
            revision=job.push.revision,
        )
        error_summary.append(summary)

    try:
        cache.set(cache_key, error_summary, BUG_SUGGESTION_CACHE_TIMEOUT)
    except Exception as e:
        newrelic.agent.record_custom_event('error caching error_summary for job', job.id)
        logger.error('error caching error_summary for job %s: %s', job.id, e, exc_info=True)

    try:
        cache.set(line_cache_key, line_cache, LINE_CACHE_TIMEOUT)
    except Exception as e:
        newrelic.agent.record_custom_event('error caching error_lines for job', job.id)
        logger.error('error caching error_lines for job %s: %s', job.id, e, exc_info=True)

    return error_summary


def bug_suggestions_line(
    err, project=None, logdate=None, term_cache=None, line_cache=None, revision=None
):
    """
    Get Bug suggestions for a given TextLogError (err).

    Tries to extract a search term from a clean version of the given error's
    line.  We build a search term from the cleaned line and use that to search
    for bugs.  Returns a dictionary with the cleaned line, the generated search
    term, and any bugs found with said search term.
    """
    if term_cache is None:
        term_cache = {}

    # store "search_terms: count"
    if logdate is None:
        # use today
        today = str(datetime.datetime.now().date())
    else:
        today = str(logdate.date())
    if today not in line_cache.keys():
        line_cache[today] = {"new_lines": {}}

    # remove the mozharness prefix
    clean_line = get_cleaned_line(err.line)

    # remove floating point numbers from the summary as they are often variable
    cache_clean_line = cache_clean_error_line(clean_line)

    # find all recent failures matching our current `clean_line`
    counter = 0
    for day in line_cache.keys():
        counter += line_cache[day].get(cache_clean_line, 0)

    count_branches = ['autoland', 'mozilla-central']
    if project and str(project.name) in count_branches:
        if cache_clean_line not in line_cache[today].keys():
            line_cache[today][cache_clean_line] = 0
            # if not seen in ALL cache, mark as new in revision
            if counter == 0:
                if "new_lines" not in line_cache[today].keys():
                    line_cache[today]["new_lines"] = {}
                if cache_clean_line not in line_cache[today]["new_lines"].keys():
                    line_cache[today]["new_lines"][cache_clean_line] = revision
        line_cache[today][cache_clean_line] += 1

    # get a meaningful search term out of the error line
    search_info = get_error_search_term_and_path(clean_line)
    search_term = search_info["search_term"]
    path_end = search_info["path_end"]
    bugs = dict(open_recent=[], all_others=[])

    # collect open recent and all other bugs suggestions
    search_terms = []
    if search_term:
        search_terms.extend(search_term)
        for term in search_term:
            if not term or not term.strip():
                continue
            if term not in term_cache:
                term_cache[term] = Bugscache.search(term)
            bugs['open_recent'].extend(term_cache[term]['open_recent'])
            bugs['all_others'].extend(term_cache[term]['all_others'])

    if not bugs or not (bugs['open_recent'] or bugs['all_others']):
        # no suggestions, try to use
        # the crash signature as search term
        crash_signature = get_crash_signature(clean_line)
        if crash_signature:
            search_terms.append(crash_signature)
            if crash_signature not in term_cache:
                term_cache[crash_signature] = Bugscache.search(crash_signature)
            bugs = term_cache[crash_signature]

    failure_new_in_rev = False
    if "new_lines" in line_cache[today] and cache_clean_line in line_cache[today]["new_lines"]:
        if revision == line_cache[today]["new_lines"][cache_clean_line]:
            failure_new_in_rev = True

    # TODO: Rename 'search' to 'error_text' or similar, since that's
    # closer to what it actually represents (bug 1091060).
    return {
        "search": clean_line,
        "search_terms": search_terms,
        "path_end": path_end,
        "bugs": bugs,
        "line_number": err.line_number,
        "counter": counter,
        "failure_new_in_rev": failure_new_in_rev,
    }, line_cache


def get_cleaned_line(line):
    """Strip possible mozharness bits from the given line."""
    line_to_clean = MOZHARNESS_RE.sub('', line).strip()
    return PROCESS_ID_RE.sub('', line_to_clean)


def cache_clean_error_line(line):
    cache_clean_line = re.sub(r' [0-9]+\.[0-9]+ ', ' X ', line)
    cache_clean_line = re.sub(r' leaked [0-9]+ window(s)', ' leaked X window(s)', cache_clean_line)
    cache_clean_line = re.sub(r' [0-9]+ bytes leaked', ' X bytes leaked', cache_clean_line)
    cache_clean_line = re.sub(r' value=[0-9]+', ' value=*', cache_clean_line)
    cache_clean_line = re.sub(r'ot [0-9]+, expected [0-9]+', 'ot X, expected Y', cache_clean_line)
    cache_clean_line = re.sub(
        r' http://localhost:[0-9]+/', ' http://localhost:X/', cache_clean_line
    )
    return cache_clean_line


def get_error_search_term_and_path(error_line):
    """
    Generate a search term from the given error_line string.

    Attempt to build a search term that will yield meaningful results when used
    in a MySQL FTS query.
    """
    if not error_line:
        return None

    # This is strongly inspired by
    # https://hg.mozilla.org/webtools/tbpl/file/tip/php/inc/AnnotatedSummaryGenerator.php#l73

    tokens = error_line.split(" | ")
    search_term = None
    path_end = None

    if len(tokens) >= 3:
        is_crash = 'PROCESS-CRASH' in tokens[0]
        # it's in the "FAILURE-TYPE | testNameOrFilePath | message" type format.
        test_name_or_path = tokens[1]
        message = tokens[2]
        if is_crash:
            test_name_or_path = tokens[2]
            message = tokens[1]
        # Leak failure messages are of the form:
        # leakcheck | .*\d+ bytes leaked (Object-1, Object-2, Object-3, ...)
        match = LEAK_RE.search(message)
        if match:
            search_term = match.group(1) if match.group(1) is not None else match.group(2)
        else:
            # For reftests, remove the reference path from the tokens as this is
            # not very unique
            test_name_or_path = REFTEST_RE.sub("", test_name_or_path).replace("\\", "/")
            path_end = test_name_or_path
            # if this is a path, we are interested in the last part
            search_term = test_name_or_path.split("/")[-1]
            if is_crash:
                search_term = message

    # If the failure line was not in the pipe symbol delimited format or the search term
    # will likely return too many (or irrelevant) results (eg: too short or matches terms
    # on the blacklist), then we fall back to searching for the entire failure line if
    # it is suitable.
    if not (search_term and is_helpful_search_term(search_term)):
        if is_helpful_search_term(error_line):
            search_term = error_line
        else:
            search_term = None
            if path_end and "/" not in path_end:
                path_end = None

    # Searching for extremely long search terms is undesirable, since:
    # a) Bugzilla's max summary length is 256 characters, and once "Intermittent "
    # and platform/suite information is prefixed, there are even fewer characters
    # left for us to use for the failure string against which we need to match.
    # b) For long search terms, the additional length does little to prevent against
    # false positives, but means we're more susceptible to false negatives due to
    # run-to-run variances in the error messages (eg paths, process IDs).
    if search_term:
        search_term = re.sub(PREFIX_PATTERN, '', search_term)
        search_term = search_term[:100]

    # for wpt tests we have testname.html?params, we need to add a search term
    # for just testname.html.
    # we will now return an array
    if search_term and '?' in search_term:
        search_name = search_term.split('?')[0]
        search_term = [search_term, search_name]
    else:
        search_term = [search_term]

    return {
        "search_term": search_term,
        "path_end": path_end,
    }


def get_crash_signature(error_line):
    """Try to get a crash signature from the given error_line string."""
    search_term = None
    match = CRASH_RE.match(error_line)
    if match and is_helpful_search_term(match.group(1)):
        search_term = match.group(1)
    return search_term


def is_helpful_search_term(search_term):
    """
    Decide if the given search_term string is helpful or not.

    We define "helpful" here as search terms that won't match an excessive
    number of bug summaries.  Very short terms and those matching generic
    strings (listed in the blacklist) are deemed unhelpful since they wouldn't
    result in useful suggestions.
    """
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
        'Return code: 10',
        'mozalloc_abort(char const*)',
        'mozalloc_abort',
        'CrashingThread(void *)',
        'gtest',
        'Last test finished',
        'leakcheck',
        'LeakSanitizer',
        '# TBPL FAILURE #',
    ]

    return len(search_term) > 4 and search_term not in blacklist


def get_useful_search_results(job):
    """
    Filter error_summary dicts if their search term is deemed "helpful"
    """
    return [item for item in get_error_summary(job) if is_helpful_search_term(item["search"])]
