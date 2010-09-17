import time, urllib, urllib2, re, os, sys
import logging as log
import cPickle as pickle
from datetime import datetime
import email.utils
from smtplib import SMTP
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import shutil
try:
    import simplejson as json
except ImportError:
    import json

from analyze import TalosAnalyzer

def bz_request(api, path, data=None, method=None, username=None, password=None):
    url = api + path
    if data:
        data = json.dumps(data)

    if username and password:
        url += "?username=%s&password=%s" % (username, password)

    req = urllib2.Request(url, data, {'Accept': 'application/json', 'Content-Type': 'application/json'})
    if method:
        req.get_method = lambda: method

    result = urllib2.urlopen(req)
    data = result.read()
    return json.loads(data)

def bz_check_request(*args, **kw):
    try:
        result = bz_request(*args, **kw)
        assert not result.get('error'), result
    except urllib2.HTTPError, e:
        assert 200 <= e.code < 300, e

def bz_get_bug(api, bug_num):
    try:
        bug = bz_request(api, "/bug/%s" % bug_num)
        return bug
    except KeyboardInterrupt:
        raise
    except:
        log.exception("Error fetching bug %s" % bug_num)
        return None

def bz_notify_bug(api, bug_num, message, whiteboard, username, password, retries=5):
    for i in range(retries):
        log.debug("Getting bug %s", bug_num)
        bug = bz_request(api, "/bug/%s" % bug_num, username=username, password=password)

        wb = bug.get('whiteboard', '')

        if whiteboard not in wb:
            bug['whiteboard'] = wb + whiteboard
            if i == 0:
                bug['last_change_time'] = "2009-09-09T16:31:18Z"

            # Add the whiteboard
            try:
                log.debug("Adding whiteboard status to bug %s", bug_num)
                bz_check_request(api, "/bug/%s" % bug_num, bug, "PUT", username=username, password=password)
            except KeyboardInterrupt:
                raise
            except:
                log.exception("Problem changing whiteboard, trying again")
                continue

        # Add the comment
        log.debug("Adding comment to bug %s", bug_num)
        bz_check_request(api, "/bug/%s/comment" % bug_num,
                {"text": message, "is_private": False}, "POST",
                username=username, password=password)
        break


def shorten(url, login, apiKey, max_tries=10, sleep_time=30):
    params = {
            'login': login,
            'apiKey': apiKey,
            'longUrl': url,
            }

    params = urllib.urlencode(params)
    api_url = "http://api.bit.ly/v3/shorten?%(params)s" % locals()

    i = 0

    while True:
        i += 1
        if i >= max_tries:
            raise IOError("Too many retries")
        data = json.load(urllib.urlopen(api_url))
        if data['status_code'] == 200:
            return data['data']['url']
        elif data['status_code'] == 403:
            # We're being rate limited
            time.sleep(sleep_time)
            continue
        else:
            raise ValueError("Unknown error: %s" % data)

def safe_shorten(url, login, apiKey):
    try:
        return shorten(url, login, apiKey)
    except KeyboardInterrupt:
        raise
    except:
        log.exception("Unable to shorten url %s", url)
        return url

def avg(l):
    return sum(l) / float(len(l))

def bugs_from_comments(comments):
    """Finds things that look like bugs in comments and returns as a list of bug numbers.

    Supported formats:
        Bug XXXXX
        Bugs XXXXXX, YYYYY
        bXXXXX
    """
    retval = []
    m = re.search("b(?:ug(?:s)?)?\s*((?:\d+[, ]*)+)", comments, re.I)
    if m:
        for m in re.findall("\d+", m.group(1)):
            retval.append(int(m))
    return retval

def send_msg(fromaddr, subject, msg, addrs, headers={}):
    s = SMTP()
    s.connect()

    for addr in addrs:
        m = MIMEText(msg, "plain", "utf8")
        m['Date'] = email.utils.formatdate()
        m['To'] = addr
        m['Subject'] = subject
        for k,v in headers.items():
            m[k] = v

        s.sendmail(fromaddr, [addr], m.as_string())
    s.quit()

class PushLog:
    def __init__(self, filename, base_url):
        self.filename = filename
        self.base_url = base_url
        self.pushes = {}

    def load(self):
        try:
            if not os.path.exists(self.filename):
                self.pushes = {}
                return
            self.pushes = json.load(open(self.filename))
        except:
            log.exception("Couldn't load push dates from %s", self.filename)
            self.pushes = {}

    def save(self):
        tmp = self.filename + ".tmp"
        json.dump(self.pushes, open(tmp, "w"), indent=2, sort_keys=True)
        os.rename(tmp, self.filename)

    def _handleJson(self, branch, data):
        if isinstance(data, dict):
            for push in data.values():
                pusher = push['user']
                for change in push['changesets']:
                    shortrev = change["node"][:12]
                    self.pushes[branch][shortrev] = {
                            "date": push['date'],
                            "comments": change['desc'],
                            "author": change['author'],
                            "pusher": pusher,
                            }

    def getPushDates(self, branch, repo_path, changesets):
        to_query = []
        retval = {}
        if branch not in self.pushes:
            self.pushes[branch] = {}

        for c in changesets:
            # Pad with zeros to work around bug where revisions with leading
            # zeros have it stripped
            while len(c) < 12:
                c = "0" + c
            shortrev = c[:12]
            if shortrev not in self.pushes[branch]:
                to_query.append(c)
            else:
                retval[c] = self.pushes[branch][shortrev]['date']

        if len(to_query) > 0:
            log.debug("Fetching %i changesets", len(to_query))
            for i in range(0, len(to_query), 50):
                chunk = to_query[i:i+50]
                changesets = ["changeset=%s" % c for c in chunk]
                base_url = self.base_url
                url = "%s/%s/json-pushes?full=1&%s" % (base_url, repo_path, "&".join(changesets))
                raw_data = urllib.urlopen(url).read()
                try:
                    data = json.loads(raw_data)
                    self._handleJson(branch, data)
                except:
                    log.exception("Error parsing %s", raw_data)
                    raise

                for c in chunk:
                    shortrev = c[:12]
                    try:
                        retval[c] = self.pushes[branch][shortrev]['date']
                    except KeyError:
                        log.debug("%s not found in push data", shortrev)
                        continue
        return retval

    def getPushRange(self, branch, repo_path, from_, to_):
        key = "%s-%s" % (from_, to_)
        if branch not in self.pushes:
            self.pushes[branch] = {"ranges": {}}
        elif "ranges" not in self.pushes[branch]:
            self.pushes[branch]["ranges"] = {}
        elif key in self.pushes[branch]["ranges"]:
            return self.pushes[branch]["ranges"][key]

        log.debug("Fetching changesets from %s to %s", from_, to_)
        base_url = self.base_url
        url = "%s/%s/json-pushes?full=1&fromchange=%s&tochange=%s" % (base_url, repo_path, from_, to_)
        raw_data = urllib.urlopen(url).read()
        try:
            data = json.loads(raw_data)
            self._handleJson(branch, data)
            retval = []
            pushes = data.items()
            pushes.sort(key=lambda p:p[1]['date'])
            for push_id, push in pushes:
                for c in push['changesets']:
                    retval.append(c['node'][:12])
            self.pushes[branch]["ranges"][key] = retval
            return retval
        except:
            log.exception("Error parsing %s", raw_data)
            return []

    def getChange(self, branch, rev):
        shortrev = rev[:12]
        return self.pushes[branch][rev]

class AnalysisRunner:
    def __init__(self, options, config):
        self.options = options
        self.config = config

        if not options.branches:
            options.branches = [s for s in config.sections() if s != "main"]

        if options.output is None or options.output == "-":
            self.output = sys.stdout
        else:
            self.output = open(options.output, "w")

        log.basicConfig(level=options.verbosity, format="%(asctime)s %(message)s")

        self.pushlog = PushLog(config.get('cache', 'pushlog'), config.get('main', 'base_hg_url'))
        self.pushlog.load()

        self.loadWarningHistory()

        self.dashboard_data = {}
        self.bug_cache = {}

        self.fore_window = config.getint('main', 'fore_window')
        self.back_window = config.getint('main', 'back_window')
        self.threshold = config.getfloat('main', 'threshold')
        self.machine_threshold = config.getfloat('main', 'machine_threshold')
        self.machine_history_size = config.getint('main', 'machine_history_size')

        # The id of the last test run we've looked at
        self.last_run = 0

        import analyze_db as source
        source.connect(config.get('main', 'dburl'))
        self.source = source

    def loadWarningHistory(self):
        # Stop warning about stuff from a long time ago
        log.debug("Loading warning history")
        fn = self.config.get('cache', 'warning_history')
        cutoff = self.options.start_time
        try:
            if not os.path.exists(fn):
                self.warning_history = {}
                return
            self.warning_history = json.load(open(fn))
            # Purge old warnings
            for branch, oses in self.warning_history.items():
                if branch in ('inactive_machines', 'bad_machines'):
                    continue
                for os_name, tests in oses.items():
                    for test_name, values in tests.items():
                        for d in values[:]:
                            buildid, timestamp = d
                            if timestamp < cutoff:
                                log.debug("Removing warning %s since it's before cutoff (%s)", d, cutoff)
                                values.remove(d)
                            else:
                                # Convert to tuples
                                values.remove(d)
                                values.append((buildid, timestamp))

                        if not values:
                            log.debug("Removing empty warning list %s %s %s", branch, os_name, test_name)
                            del tests[test_name]
                    if not tests:
                        log.debug("Removing empty os list %s %s", branch, os_name)
                        del oses[os_name]
                if not oses:
                    log.debug("Removing empty branch list %s", branch)
                    del self.warning_history[branch]
        except:
            log.exception("Couldn't load warnings from %s", fn)
            self.warning_history = {}

    def saveWarningHistory(self):
        fn = self.config.get('cache', 'warning_history')
        tmp = fn + ".tmp"
        json.dump(self.warning_history, open(tmp, "w"), indent=2, sort_keys=True)
        os.rename(tmp, fn)

    def updateTimes(self, branch, data):
        # We want to fetch the changesets so we can order the data points by
        # push time, rather than by test time
        changesets = set(d.revision for d in data)

        dates = self.pushlog.getPushDates(branch, self.config.get(branch, 'repo_path'), changesets)

        for d in data:
            rev = dates.get(d.revision, None)
            if rev:
                d.time = rev

    def shorten(self, url):
        if self.config.has_option('main', 'bitly_login'):
            login = self.config.get('main', 'bitly_login')
            apiKey = self.config.get('main', 'bitly_apiKey')
            return safe_shorten(url, login, apiKey)
        else:
            return url

    def makeChartUrl(self, series, d=None):
        test_params = []
        machine_ids = self.source.getMachinesForTest(series)
        for machine_id in machine_ids:
            test_params.append((series.test_id, series.branch_id, machine_id))

        test_params = json.dumps(test_params, separators=(",",":"))
        #test_params = urllib.quote(test_params)
        base_url = self.config.get('main', 'base_graph_url')
        if d is not None:
            start_time = d.timestamp - 24*3600
            end_time = d.timestamp + 24*3600
            return "%(base_url)s/graph.html#tests=%(test_params)s&sel=%(start_time)s,%(end_time)s" % locals()
        else:
            return "%(base_url)s/graph.html#tests=%(test_params)s" % locals()

    def makeHgUrl(self, branch, good_rev, bad_rev):
        base_url = self.config.get('main', 'base_hg_url')
        repo_path = self.config.get(branch, 'repo_path')
        if good_rev:
            hg_url = "%(base_url)s/%(repo_path)s/pushloghtml?fromchange=%(good_rev)s&tochange=%(bad_rev)s" % locals()
        else:
            hg_url = "%(base_url)s/%(repo_path)s/rev/%(bad_rev)s" % locals()
        return hg_url

    def makeBugUrl(self, bug_num):
        return "http://bugzilla.mozilla.org/show_bug.cgi?id=%s" % bug_num

    def getBug(self, bug_num):
        if bug_num in self.bug_cache:
            return self.bug_cache[bug_num]

        if self.config.has_option('main', 'bz_api'):
            bug = bz_get_bug(self.config.get('main', 'bz_api'), bug_num)
            if bug:
                self.bug_cache[bug_num] = bug
                return bug

    def isTestReversed(self, test_name):
        reversed_tests = []
        if self.config.has_option('main', 'reverse_tests'):
            for i in self.config.get('main', 'reverse_tests').split(','):
                reversed_tests.append(i.strip())

        for text_exp in reversed_tests:
            if re.search(text_exp, test_name, re.I):
                return True
        return False

    def isImprovement(self, test_name, old, new):
        old_value = new.historical_stats['avg']
        new_value = new.forward_stats['avg']

        if self.isTestReversed(test_name):
            return new_value > old_value
        else:
            return new_value < old_value

    def formatMessage(self, state, series, good, bad):
        if state == "machine":
            good = bad.last_other

        branch_name = series.branch_name
        test_name = series.test_name
        os_name = series.os_name

        initial_value = bad.historical_stats['avg']
        initial_stddev = bad.historical_stats['variance'] ** 0.5
        history_n = bad.historical_stats['n']

        new_value = bad.forward_stats['avg']
        new_stddev = bad.forward_stats['variance'] ** 0.5
        forward_n = bad.forward_stats['n']

        change = 100.0 * abs(new_value - initial_value) / float(initial_value)
        delta = (new_value - initial_value)

        z_score = abs(delta / initial_stddev)

        if self.isImprovement(test_name, good, bad):
            reason = "Improvement!"
        else:
            reason = "Regression :("

        if new_value > initial_value:
            direction = "increase"
        else:
            direction = "decrease"

        chart_url = self.shorten(self.makeChartUrl(series, bad))
        if good.revision:
            good_rev = "revision %s" % good.revision
        else:
            good_rev = "(unknown revision)"

        if bad.revision:
            bad_rev = "revision %s" % bad.revision
        else:
            bad_rev = "(unknown revision)"

        if good.revision and bad.revision:
            hg_url = self.makeHgUrl(branch_name, good.revision, bad.revision)
            revisions = self.pushlog.getPushRange(branch_name,
                    self.config.get(branch_name, 'repo_path'), from_=good.revision,
                    to_=bad.revision)
        else:
            hg_url = ""
            revisions = []

        if state == "machine":
            bad_machine_name = self.source.getMachineName(bad.machine_id)
            reason = "Suspected machine issue (%s)" % bad_machine_name
            msg =  """\
%(reason)s: %(test_name)s %(direction)s %(change).3g%% on %(os_name)s %(branch_name)s
    Previous: avg %(initial_value).3f stddev %(initial_stddev).3f
    New     : avg %(new_value).3f stddev %(new_stddev).3f
    Change  : %(delta)+.3f (%(change).3g%% / z=%(z_score).3f)
    Graph   : %(chart_url)s
""" % locals()
        else:
            header = "%(reason)s %(test_name)s %(direction)s %(change).3g%% on %(os_name)s %(branch_name)s" % locals()
            dashes = "-" * len(header)
            msg =  """\
%(header)s
%(dashes)s
    Previous: avg %(initial_value).3f stddev %(initial_stddev).3f of %(history_n)i runs up to %(good_rev)s
    New     : avg %(new_value).3f stddev %(new_stddev).3f of %(forward_n)i runs since %(bad_rev)s
    Change  : %(delta)+.3f (%(change).3g%% / z=%(z_score).3f)
    Graph   : %(chart_url)s

""" % locals()
            if hg_url:
                msg += "Changeset range: %(hg_url)s\n\n" % locals()

            bugs = set()
            # Fuzzy limit is slightly higher to prevent omitting just a small
            # number of revisions
            # e.g. if fuzzy limit is 5 higher than limit, then up to 5 extra
            # revisions past the limit will be output.  If the number of
            # revisions exceeds the fuzzy limit, then revision_limit will be
            # used.
            revision_limit = 15
            revision_fuzzy_limit = 20
            if len(revisions) < revision_fuzzy_limit:
                revision_limit = revision_fuzzy_limit
            if revisions:
                msg += "Changesets:\n"
                for i, rev in enumerate(revisions):
                    url = self.makeHgUrl(branch_name, None, rev)
                    changeset = self.pushlog.getChange(branch_name, rev)
                    author = changeset['author'].encode("utf8")
                    comments = changeset['comments'].encode("utf8")
                    these_bugs = bugs_from_comments(comments)
                    bugs.update(these_bugs)
                    if i < revision_limit:
                        msg += """\
  * %(url)s
    : %(author)s - %(comments)s
""" % locals()
                        for bug in these_bugs:
                            bug_url = self.makeBugUrl(bug)
                            msg += "    : %(bug_url)s\n" % locals()
                        msg += "\n"
                if len(revisions) > revision_limit:
                    msg += "  * and %i more\n\n" % (len(revisions) - revision_limit)

            bug_limit = 15
            bug_fuzzy_limit = 20
            bugs = list(bugs)
            if len(bugs) < bug_fuzzy_limit:
                bug_limit = bug_fuzzy_limit
            if bugs:
                msg += "Bugs:\n"
                for bug_num in bugs[:bug_limit]:
                    bug_url = self.makeBugUrl(bug_num)
                    bug = self.getBug(bug_num)
                    if bug:
                        bug_desc = bug['summary'].encode("utf8")
                        msg += "  * %(bug_url)s - %(bug_desc)s\n" % locals()
                    else:
                        msg += "  * %(bug_url)s\n" % locals()
                if len(bugs) > bug_limit:
                    msg += "  * and %i more\n" % (len(bugs) - bug_limit)

        return msg

    def formatSubject(self, state, series, good, bad):
        if state == "machine":
            good = bad.last_other

        branch_name = series.branch_name
        test_name = series.test_name
        os_name = series.os_name

        initial_value = bad.historical_stats['avg']
        new_value = bad.forward_stats['avg']

        change = 100.0 * abs(new_value - initial_value) / float(initial_value)

        if self.isImprovement(test_name, good, bad):
            reason = "Improvement!"
        else:
            reason = "Regression :("

        if new_value > initial_value:
            direction = "increase"
        else:
            direction = "decrease"

        if state == "machine":
            bad_machine_name = self.source.getMachineName(bad.machine_id)
            good_machine_name = self.source.getMachineName(good.machine_id)
            reason = "Suspected machine issue (%s)" % bad_machine_name
        return "Talos %(reason)s %(test_name)s %(direction)s %(change).3g%% on %(os_name)s %(branch_name)s" % locals()

    def printWarning(self, series, d, state, last_good):
        if self.output:
            self.output.write(self.formatMessage(state, series, last_good, d))
            self.output.write("\n")
            self.output.flush()

    def bugComment(self, series, bad, state, good):
        # Ignore machine issues
        if state != "regression":
            log.debug("Ignoring non-regression event %s", state)
            return

        if not (good.revision and bad.revision):
            # Can't find a range, so give up
            log.info("No revision range for %s, not posting bug comment" % bad)
            return

        branch = series.branch_name
        test_name = series.test_name
        short_name = series.test_shortname
        os_name = series.os_name

        # Don't comment for good things
        if self.isImprovement(test_name, good, bad):
            log.debug("Not commenting on bug for improvement")
            return

        initial_value = bad.historical_stats['avg']
        initial_stddev = bad.historical_stats['variance'] ** 0.5
        history_n = bad.historical_stats['n']

        new_value = bad.forward_stats['avg']
        new_stddev = bad.forward_stats['variance'] ** 0.5
        forward_n = bad.forward_stats['n']

        change = 100.0 * (new_value - initial_value) / float(initial_value)
        delta = (new_value - initial_value)
        z_score = abs(delta / initial_stddev)

        good_rev = good.revision
        bad_rev = bad.revision

        hg_url = self.makeHgUrl(branch, good_rev, bad_rev)

        # Get all the changesets in the range
        revisions = self.pushlog.getPushRange(branch,
                self.config.get(branch, 'repo_path'), from_=good_rev,
                to_=bad_rev)

        whiteboard = self.config.get('main', 'bz_whiteboard') % locals()
        username = self.config.get('main', 'bz_username')
        password = self.config.get('main', 'bz_password')
        api = self.config.get('main', 'bz_api')

        graph = self.shorten(self.makeChartUrl(series, bad))

        if self.config.has_option('main', 'bz_bug_override'):
            bug_override = self.config.get('main', 'bz_bug_override')
        else:
            bug_override = None

        bugs = set()
        for rev in revisions:
            c = self.pushlog.getChange(branch, rev)
            bugs.update(bugs_from_comments(c['comments']))

        for bug in bugs:
            log.debug("Bug %s is implicated", bug)
            message = """\
A changeset from this bug was associated with a %(os_name)s %(test_name)s regression on %(branch)s. boo-urns :(

  Previous: avg %(initial_value).3f stddev %(initial_stddev).3f of %(history_n)i runs up to %(good_rev)s
  New     : avg %(new_value).3f stddev %(new_stddev).3f of %(forward_n)i runs since %(bad_rev)s
  Change  : %(delta)+.3f (%(change).3g%% / z=%(z_score).3f)
  Graph   : %(graph)s

The regression occurred from changesets in the following range:
%(hg_url)s

The tag %(whiteboard)s has been added to the status whiteboard;
please remove it only once you have confirmed this bug is not the cause
of the regression.""" % locals()

            notify_bug = bug_override or bug
            log.info("Notifying bug %s" , notify_bug)

            bz_notify_bug(api, notify_bug, message, whiteboard, username, password)

    def emailWarning(self, series, d, state, last_good):
        addresses = []
        branch = series.branch_name
        if state == 'regression':
            if self.config.has_option(branch, 'regression_emails'):
                addresses.extend(self.config.get(branch, 'regression_emails').split(","))
            elif self.config.has_option('main', 'regression_emails'):
                addresses.extend(self.config.get('main', 'regression_emails').split(","))

        if state == 'machine' and self.config.has_option('main', 'machine_emails'):
            addresses.extend(self.config.get('main', 'machine_emails').split(","))

        if self.config.has_option('main', 'email_authors') and \
                self.config.getboolean('main', 'email_authors') and \
                state == 'regression' and \
                not self.isImprovement(series.test_name, last_good, d):

            for rev in self.pushlog.getPushRange(branch, self.config.get(branch, 'repo_path'), from_=last_good.revision,
                    to_=d.revision):
                c = self.pushlog.getChange(branch, rev)
                author = email.utils.parseaddr(c['author'])
                if author != ('', ''):
                    author = email.utils.formataddr(author)
                pusher = email.utils.parseaddr(c['pusher'])
                if pusher != ('', ''):
                    pusher = email.utils.formataddr(pusher)

                if author not in addresses:
                    log.debug("Adding author %s to recipients", author)
                    addresses.append(author)

                if pusher not in addresses:
                    log.debug("Adding pusher %s to recipients", pusher)
                    addresses.append(pusher)

        log.debug("Mailing %s", addresses)
        if addresses:
            addresses = [a.strip() for a in addresses]
            subject = self.formatSubject(state, series, last_good, d)
            msg = self.formatMessage(state, series, last_good, d)
            if last_good.revision:
                headers = {'In-Reply-To': '<talosbustage-%s>' % last_good.revision}
                headers['References'] = headers['In-Reply-To']
            else:
                headers = {}
            send_msg(self.config.get('main', 'from_email'), subject, msg, addresses, headers)

    def outputDashboard(self):
        log.debug("Creating dashboard")

        dirname = self.config.get('main', 'dashboard_dir')
        if not os.path.exists(dirname):
            # Copy in the rest of html
            shutil.copytree('html/dashboard', dirname)
            shutil.copytree('html/flot', '%s/flot' % dirname)
            shutil.copytree('html/jquery', '%s/jquery' % dirname)
        filename = os.path.join(dirname, 'testdata.js')
        fp = open(filename + ".tmp", "w")
        now = time.asctime()
        fp.write("// Generated at %s\n" % now)
        fp.write("gFetchTime = ")
        json.dump(now, fp, separators=(',',':'))
        fp.write(";\n")
        fp.write("var gData = ")
        # Hackity hack
        # Don't pretend we have double precision here
        # 8 digits of precision is plenty
        try:
            json.encoder.FLOAT_REPR = lambda f: "%.8g" % f
        except:
            pass
        json.dump(self.dashboard_data, fp, separators=(',',':'), sort_keys=True)
        try:
            json.encoder.FLOAT_REPR = repr
        except:
            pass

        fp.write(";\n")
        fp.close()
        os.rename(filename + ".tmp", filename)

    def outputGraphs(self, series, series_data):
        all_data = []
        good_data = []
        regressions = []
        bad_machines = {}
        graph_dir = self.config.get('main', 'graph_dir')
        test_name = series.test_name.replace("/", "_")
        basename = "%s/%s-%s-%s" % (graph_dir,
                series.branch_name, series.os_name, test_name)

        for s, d, state, skip, last_good in series_data:
            graph_point = (d.time * 1000, d.value)
            all_data.append(graph_point)
            if state == "good":
                good_data.append(graph_point)
            elif state == "regression":
                regressions.append(graph_point)
            elif state == "machine":
                bad_machines.setdefault(d.machine_id, []).append(graph_point)

        log.debug("Creating graph %s", basename)

        graphs = []
        graphs.append({"label": "Value", "data": all_data})

        graphs.append({"label": "Smooth Value", "data": good_data, "color": "green"})
        graphs.append({"label": "Regressions", "color": "red", "data": regressions, "lines": {"show": False}, "points": {"show": True}})
        for machine_id, points in bad_machines.items():
            machine_name = self.source.getMachineName(machine_id)
            graphs.append({"label": "Bad Machines (%s)" % machine_name, "data": points, "lines": {"show": False}, "points": {"show": True}})

        graph_file = "%s.js" % basename
        html_file = "%s.html" % basename
        html_template = open("html/graph_template.html").read()

        test_name = series.test_name
        os_name = series.os_name
        branch_name = series.branch_name

        title = "Talos Regression Graph for %(test_name)s on %(os_name)s %(branch_name)s" % locals()

        html = html_template % dict(graph_file = os.path.basename(graph_file),
                title=title)
        if not os.path.exists(graph_dir):
            os.makedirs(graph_dir)
            # Copy in the rest of the HTML as well
            shutil.copytree('html/flot', '%s/flot' % graph_dir)

        open(html_file, "w").write(html)
        open(graph_file, "w").write("var graph_data = %s;" % json.dumps(graphs))

    def findInactiveMachines(self):
        log.debug("Finding inactive machines...")

        if "inactive_machines" not in self.warning_history:
            self.warning_history['inactive_machines'] = {}

        now = time.time()
        # Look back 2 weeks to find machines that are active
        initial_time = datetime.fromtimestamp(now - 14*24*3600)
        # Complain about anything that hasn't reported in 3 days
        cutoff = datetime.fromtimestamp(now - 3*24*3600)
        end_time = datetime.fromtimestamp(now)

        addresses = []
        if self.config.has_option('main', 'machine_emails'):
            addresses.extend(self.config.get('main', 'machine_emails').split(","))

        for machine_name in self.source.getInactiveMachines(
                self.config.get('main', 'statusdb'),
                initial_time,
                cutoff,
                end_time):

            # When did we last warn about this machine?
            if self.warning_history['inactive_machines'].get(machine_name, 0) < time.time() - 7*24*3600:
                # If it was over a week ago, then send another warning
                self.warning_history['inactive_machines'][machine_name] = time.time()

                subject = "Inactive machine: %s" % machine_name
                msg = "Machine %s hasn't done any work since %s" % (
                        machine_name, cutoff.strftime("%Y-%m-%d %H:%M:%S"))

                self.output.write(msg)
                self.output.write("\n")
                self.output.flush()

                if addresses:
                    send_msg(self.config.get('main', 'from_email'), subject, msg, addresses)

    def handleData(self, series, d, state, skip, last_good):
        if not skip and state != "good" and not self.options.catchup and last_good is not None:
            # Notify people of the warnings
            self.printWarning(series, d, state, last_good)
            self.emailWarning(series, d, state, last_good)
            if self.config.has_option('main', 'bz_username') and self.config.has_option('main', 'bz_api'):
                self.bugComment(series, d, state, last_good)

    def handleSeries(self, s):
        if self.config.has_option('os', s.os_name):
            s.os_name = self.config.get('os', s.os_name)

        # Check if we should skip this test
        ignore_tests = []
        if self.config.has_option('main', 'ignore_tests'):
            for i in self.config.get('main', 'ignore_tests').split(','):
                i = i.strip()
                if i:
                    ignore_tests.append(i)

        if self.config.has_option(s.branch_name, 'ignore_tests'):
            for i in self.config.get(s.branch_name, 'ignore_tests').split(','):
                i = i.strip()
                if i:
                    ignore_tests.append(i)

        for i in ignore_tests:
            if re.search(i, s.test_name):
                log.debug("Skipping %s %s %s", s.branch_name, s.os_name, s.test_name)
                return

        log.info("Processing %s %s %s", s.branch_name, s.os_name, s.test_name)

        # Get all the test data for all machines running this combination
        t = time.time()
        data = self.source.getTestData(s, options.start_time)
        log.debug("%.2f to fetch data", time.time() - t)

        # Add it to our dashboard data
        sevenDaysAgo = time.time() - 7*24*60*60
        importantTests = []
        for t in re.split(r"(?<!\\),", self.config.get("dashboard", "tests")):
            t = t.replace("\\,", ",").strip()
            importantTests.append(t)

        if data:
            m = max(d.testrun_id for d in data)
            if self.last_run < m:
                log.debug("Setting last_run to %s", m)
                self.last_run = m

        if s.test_name in importantTests and len(data) > 0:
            # We want to merge the Tp3 (Memset) and Tp3 (RSS) results together
            # for the dashboard, since they're just different names for the
            # same thing on different platforms
            test_name = s.test_name
            if test_name == "Tp3 (Memset)":
                test_name = "Tp3 (RSS)"
            elif test_name == "Tp4 (Memset)":
                test_name = "Tp4 (RSS)"
            self.dashboard_data.setdefault(s.branch_name, {})
            self.dashboard_data[s.branch_name].setdefault(test_name, {'_testid': s.test_id})
            self.dashboard_data[s.branch_name][test_name].setdefault(s.os_name, {'_platformid': s.os_id, '_graphURL': self.makeChartUrl(s)})
            _d = self.dashboard_data[s.branch_name][test_name][s.os_name]

            for d in data:
                if d.timestamp < sevenDaysAgo:
                    continue
                machine_name = self.source.getMachineName(d.machine_id)
                if machine_name not in _d:
                    _d[machine_name] = {
                            'results': [],
                            'stats': [],
                            }
                results = _d[machine_name]['results']
                results.append(d.timestamp)
                results.append(d.value)

            for machine_name in _d:
                if machine_name.startswith("_"):
                    continue
                results = _d[machine_name]['results']
                values = [results[i+1] for i in range(0, len(results), 2)]
                _d[machine_name]['stats'] = [avg(values), max(values), min(values)]

        self.updateTimes(s.branch_name, data)

        a = TalosAnalyzer()
        a.addData(data)

        analysis_gen = a.analyze_t(self.back_window, self.fore_window,
                self.threshold, self.machine_threshold,
                self.machine_history_size)

        if s.branch_name not in self.warning_history:
            self.warning_history[s.branch_name] = {}
        if s.os_name not in self.warning_history[s.branch_name]:
            self.warning_history[s.branch_name][s.os_name] = {}
        if s.test_name not in self.warning_history[s.branch_name][s.os_name]:
            self.warning_history[s.branch_name][s.os_name][s.test_name] = []
        warnings = self.warning_history[s.branch_name][s.os_name][s.test_name]

        last_good = None
        last_err = None
        last_err_good = None
        # Uncomment this for debugging!
        #cutoff = self.options.start_time
        cutoff = time.time() - 7*24*3600
        series_data = []
        for d, state in analysis_gen:
            skip = False
            if d.timestamp < cutoff:
                continue

            if state != "good":
                # Skip warnings about regressions we've already
                # warned people about
                if (d.buildid, d.timestamp) in warnings:
                    skip = True
                else:
                    warnings.append((d.buildid, d.timestamp))
                    if state == "machine":
                        machine_name = self.source.getMachineName(d.machine_id)
                        if 'bad_machines' not in self.warning_history:
                            self.warning_history['bad_machines'] = {}
                        # When did we last warn about this machine?
                        if self.warning_history['bad_machines'].get(machine_name, 0) > time.time() - 7*24*3600:
                            skip = True
                        else:
                            # If it was over a week ago, then send another warning
                            self.warning_history['bad_machines'][machine_name] = time.time()

                if not last_err:
                    last_err = d
                    last_err_good = last_good
                elif last_err_good == last_good:
                    skip = True

            else:
                last_err = None
                last_good = d

            series_data.append((s, d, state, skip, last_good))
            self.handleData(s, d, state, skip, last_good)

        if self.config.has_option('main', 'graph_dir'):
            self.outputGraphs(s, series_data)

    def loadSeries(self):
        start_time = self.options.start_time
        if self.config.has_option('cache', 'last_run_file'):
            try:
                self.last_run = int(open(self.config.get('cache', 'last_run_file')).read())
                log.debug("Using %s as our last_run", self.last_run)
            except:
                self.last_run = 0
                log.debug("Could't load last run time, using %s as start time", start_time)
        series = self.source.getTestSeries(self.options.branches, start_time, self.options.tests, self.last_run)
        return series

    def run(self):
        log.info("Fetching list of tests")
        series = self.loadSeries()
        self.done = False

        while not self.done:
            if not series:
                break
            s = series.pop()
            self.handleSeries(s)

        if self.config.has_option('main', 'dashboard_dir'):
            self.outputDashboard()

        if not self.options.catchup:
            self.findInactiveMachines()

    def save(self, errors=False):
        try:
            self.saveWarningHistory()
        except:
            log.exception("Error saving warning history")

        try:
            self.pushlog.save()
        except:
            log.exception("Error saving pushlog")

        if not errors:
            try:
                if self.config.has_option('cache', 'last_run_file'):
                    open(self.config.get('cache', 'last_run_file'), 'w').write("%i" % self.last_run)
            except:
                log.exception("Error saving last time")

if __name__ == "__main__":
    from optparse import OptionParser
    from ConfigParser import RawConfigParser

    parser = OptionParser()
    parser.add_option("-b", "--branch", dest="branches", action="append")
    parser.add_option("-t", "--test", dest="tests", action="append")
    parser.add_option("-o", "--output", dest="output", help="output file")
    parser.add_option("-q", "--quiet", dest="verbosity", action="store_const", const=log.WARN)
    parser.add_option("-v", "--verbose", dest="verbosity", action="store_const", const=log.DEBUG)
    parser.add_option("-e", "--email", dest="addresses", help="send regression notices to this email address", action="append")
    parser.add_option("-m", "--machine-email", dest="machine_addresses", help="send machine notices to this email address", action="append")
    parser.add_option("-c", "--config", dest="config", help="config file to read")
    parser.add_option("", "--start-time", dest="start_time", type="int", help="timestamp for when we start looking at data")
    parser.add_option("", "--catchup", dest="catchup", action="store_true", help="Don't output any warnings, just process data")

    parser.set_defaults(
            branches = [],
            tests = [],
            start_time = time.time() - 30*24*3600,
            verbosity = log.INFO,
            output = None,
            json = None,
            addresses = [],
            machine_addresses = [],
            config = "analysis.cfg",
            catchup = False,
            )

    options, args = parser.parse_args()

    config = RawConfigParser()
    config.add_section('main')
    config.add_section('cache')
    # Set some defaults
    config.set('cache', 'warning_history', 'warning_history.json')
    config.set('cache', 'pushlog', 'pushlog.json')
    config.set('cache', 'last_run_file', 'lastrun.txt')
    config.read([options.config])

    if options.addresses:
        config.set('main', 'regression_emails', ",".join(option.addresses))
    if options.machine_addresses:
        config.set('main', 'machine_emails', ",".join(option.machine_addresses))

    runner = AnalysisRunner(options, config)
    try:
        runner.run()
        runner.save()
    except:
        runner.save(errors=True)
        raise
