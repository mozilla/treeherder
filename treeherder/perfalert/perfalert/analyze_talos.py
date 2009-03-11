import time, urllib, re
import cPickle
import logging as log
import email.utils
import simplejson
from smtplib import SMTP

from analyze import TalosAnalyzer, PerfDatum
from graphsdb import db

def getTestData(branch_id, os_id, test_id, start_date):
    cursor = db.cursor()
    sql = """SELECT
        machine_id,
        ref_build_id,
        date_run,
        average,
        ref_changeset
    FROM
        test_runs INNER JOIN machines ON (machine_id = machines.id)
            INNER JOIN builds ON (build_id = builds.id)
    WHERE
        test_id = %(test_id)s AND
        os_id = %(os_id)s AND
        branch_id = %(branch_id)s AND
        date_run > %(start_date)s
    """
    cursor.execute(sql, locals())
    data = []
    for row in cursor:
        machine_id, ref_build_id, date_run, average, ref_changeset = row
        if average is None:
            continue
        t = date_run
        d = PerfDatum(machine_id, date_run, average, ref_build_id, t, ref_changeset)
        data.append(d)
    return data

def getTestSeries(branches, start_date, test_names):
    # Find all the Branch/OS/Test combinations
    branch_places = ",".join(["%s"] * len(branches))
    test_places = ",".join(["%s"] * len(test_names))
    sql = """SELECT DISTINCT 
        branch_id,
        branches.name AS branch_name,
        os_id,
        os_list.name AS os_name,
        test_id,
        tests.name AS test_name
    FROM
         test_runs INNER JOIN machines ON (machine_id = machines.id)
            INNER JOIN builds ON (build_id = builds.id)
            INNER JOIN branches ON (branch_id = branches.id)
            INNER JOIN os_list ON (os_id = os_list.id)
            INNER JOIN tests ON (test_id = tests.id)
    WHERE
        date_run > %%s AND
        branches.name IN (%(branch_places)s)
    """
    if len(test_names) > 0:
        sql += "AND tests.name IN (%(test_places)s)"
    sql = sql % locals()

    cursor = db.cursor()
    args = [start_date] + branches + test_names
    cursor.execute(sql, args)
    return cursor.fetchall()

def getMachinesForTest(branch_id, test_id, os_id):
    sql = """SELECT DISTINCT
        machine_id
    FROM
        test_runs INNER JOIN machines ON (machine_id = machines.id)
            INNER JOIN tests ON (test_id = tests.id)
            INNER JOIN builds ON (build_id = builds.id)
    WHERE
        branch_id = %(branch_id)s AND
        test_id = %(test_id)s AND
        os_id = %(os_id)s
    """
    cursor = db.cursor()
    cursor.execute(sql, locals())
    return [row[0] for row in cursor.fetchall()]

class PushLog(object):
    pushlogs = {}
    @classmethod
    def getPushLog(cls, branch):
        #branch = {"1.9.2": "mozilla-central", "1.9.1": "releases/mozilla-1.9.1", "TraceMonkey": "tracemonkey"}.get(branch)
        #branch = {"mozilla-central": "mozilla-central", "mozilla-1.9.1": "releases/mozilla-1.9.1", "TraceMonkey": "tracemonkey"}.get(branch)
        branch = {"Firefox": "mozilla-central", "Firefox3.1": "releases/mozilla-1.9.1", "TraceMonkey": "tracemonkey"}.get(branch)
        if not branch:
            return None
        if branch in cls.pushlogs:
            return cls.pushlogs[branch]
        else:
            retval = cls(branch)
            cls.pushlogs[branch] = retval
            return retval

    def __init__(self, branch):
        self.branch = branch
        try:
            self.cache = cPickle.load(open("%s-pushlog.pck" % os.path.basename(branch)))
        except:
            self.cache = {}

    def _updateCache(self, changesets):
        if len(changesets) > 0:
            log.debug("Fetching %i changesets", len(changesets))
            for c in changesets:
                data = simplejson.load(urllib.urlopen("http://hg.mozilla.org/%s/json-pushes?changeset=%s" % (self.branch, c)))
                if isinstance(data, dict):
                    for entry in data.values():
                        for changeset in entry['changesets']:
                            self.cache[changeset[:12]] = entry
                    cPickle.dump(self.cache, open("%s-pushlog.pck" % os.path.basename(self.branch), "w"))
                else:
                    log.debug("Couldn't get push time for %s on branch %s", c, self.branch)
                    self.cache[c[:12]] = None
            log.debug("Done fetching changesets")

            #changesets = ["changeset=%s" % c for c in changesets]
            #data = simplejson.load(urllib.urlopen("http://hg.mozilla.org/%s/json-pushes?%s" % (self.branch, "&".join(changesets))))
            #if isinstance(data, dict):
                #for entry in data.values():
                    #for changeset in entry['changesets']:
                        #self.cache[changeset[:12]] = entry
                #cPickle.dump(self.cache, open("%s-pushlog.pck" % os.path.basename(self.branch), "w"))

    def getPushData(self, changesets):
        changesets = [c.rstrip("+") for c in changesets]
        to_query = set(changesets) - set(self.cache.keys())
        self._updateCache(to_query)
        return dict([(c, self.cache.get(c)) for c in changesets])

def send_msg(subject, msg, addrs):
    s = SMTP()
    s.connect()
    date = email.utils.formatdate()
    for addr in addrs:
        msg = """From: catlee@mozilla.com
To: %(addr)s
Date: %(date)s
Subject: %(subject)s

%(msg)s""" % locals()
        s.sendmail("catlee@mozilla.com", [addr], msg)
    s.quit()


def create_subject(branch_name, branch_id, os_name, os_id, test_name, test_id, good, bad):
    initial_value = good.value
    new_value = bad.value
    change = abs(new_value - initial_value) / float(initial_value)
    bad_build_time = datetime.fromtimestamp(bad.timestamp).strftime("%Y-%m-%d %H:%M:%S")
    good_build_time = datetime.fromtimestamp(good.timestamp).strftime("%Y-%m-%d %H:%M:%S")
    if new_value > initial_value:
        direction = "increase"
        reason = "Regression"
    else:
        direction = "decrease"
        reason = "Improvement"
    return "Talos %(reason)s: %(test_name)s %(direction)s %(change).2f%% on %(os_name)s %(branch_name)s" % locals()

def create_msg(branch_name, branch_id, os_name, os_id, test_name, test_id, good, bad):
    initial_value = good.value
    new_value = bad.value
    change = abs(new_value - initial_value) / float(initial_value)
    bad_build_time = datetime.fromtimestamp(bad.timestamp).strftime("%Y-%m-%d %H:%M:%S")
    good_build_time = datetime.fromtimestamp(good.timestamp).strftime("%Y-%m-%d %H:%M:%S")
    if new_value > initial_value:
        direction = "increase"
        reason = "Regression"
    else:
        direction = "decrease"
        reason = "Improvement"

    machine_ids = getMachinesForTest(branch_id, test_id, os_id)

    chart_url = make_chart_url(branch_id, test_id, machine_ids, bad)
    if good.revision:
        good_rev = "revision %s" % good.revision
    else:
        good_rev = "(unknown revision)"

    if bad.revision:
        bad_rev = "revision %s" % bad.revision
    else:
        bad_rev = "(unknown revision)"

    if good.revision and bad.revision:
        hg_url = "\n    " + make_hg_url(branch_name, bad.revision, good.revision)
    else:
        hg_url = ""

    bad_build_id = bad.buildid
    good_build_id = good.buildid

    msg =  """\
%(reason)s: %(test_name)s %(direction)s %(change).2f%% on %(os_name)s %(branch_name)s
    Previous results:
        %(initial_value)s from build %(good_build_id)s of %(good_rev)s at %(good_build_time)s
    New results:
        %(new_value)s from build %(bad_build_id)s of %(bad_rev)s at %(bad_build_time)s
    %(chart_url)s%(hg_url)s
""" % locals()
    return msg

def make_chart_url(branch_id, test_id, machine_ids, d):
    test_params = []
    for machine_id in machine_ids:
        test_params.append(dict(test=test_id, branch=branch_id, machine=machine_id))
    test_params = simplejson.dumps(test_params).replace(" ", "")
    start_time = d.timestamp - 24*3600
    end_time = d.timestamp + 24*3600
    return "http://graphs-stage2.mozilla.org/graph.html#tests=%(test_params)s&sel=%(start_time)s,%(end_time)s" % locals()

def make_hg_url(branch, rev, good_rev=None):
    if branch == "Firefox":
        branch_path = "mozilla-central"
    elif branch == "Firefox3.1":
        branch_path = "releases/mozilla-1.9.1"
    else:
        raise ValueError("Unknown branch %s" % branch)

    if good_rev:
        hg_url = "http://hg.mozilla.org/%(branch_path)s/pushloghtml?fromchange=%(good_rev)s&tochange=%(rev)s" % locals()
    else:
        hg_url = "http://hg.mozilla.org/%(branch_path)s/rev/%(rev)s" % locals()
    return hg_url

def load_warning_history(fn, cutoff):
    # Stop warning about stuff from a long time ago
    try:
        warning_history = cPickle.load(open(fn))
        # Purge old warnings
        for key, values in warning_history.items():
            for d in values[:]:
                buildid, timestamp = d
                if timestamp < cutoff:
                    values.remove(d)
    except:
        warning_history = {}
    return warning_history

def update_data_with_pushdate(data):
    # We want to fetch the changesets so we can order the data points by
    # push time, rather than by test time
    changesets = set(d.revision for d in data)

    pushlog = PushLog.getPushLog(branch_name)
    if pushlog:
        pushdata = pushlog.getPushData(changesets)
        for d in data:
            if d.revision in pushdata:
                d.time = pushdata[d.revision]['date']

def primedgenerator(func):
    def starter(*args, **kwargs):
        f = func(*args, **kwargs)
        f.next()
        return f
    return starter

def history_filter(gen, cutoff, old_warnings):
    for d, state in gen:
        if d.time < cutoff:
            yield d, state, "skip"
            continue

        if (d.buildid, d.timestamp) in old_warnings:
            yield d, state, "skip"
            continue

        old_warnings.append((d.buildid, d.timestamp))
        yield d, state, "ok"

def lastgood_filter(gen):
    last_good = None
    for d, state, skip in gen:
        if last_good is None:
            if state == "good":
                last_good = d

        yield d, state, skip, last_good

        if state == "good":
            last_good = d
            continue

def redundant_filter(gen):
    last_err = None
    last_err_good = None
    for d, state, skip, last_good in gen:
        if state != "good":
            if not last_err:
                last_err = d
            elif last_err_good == last_good:
                # Skip it!
                skip = "skip"
        else:
            last_err = None

        yield d, state, skip, last_good
        last_err_good = last_good

def send_data(gen, targets):
    for d, state, skip, last_good in gen:
        for t in targets:
            t.send((d, state, skip, last_good))

    for t in targets:
        t.close()

@primedgenerator
def printer(output, **kwargs):
    while True:
        d, state, skip, last_good = yield()
        if skip == "skip":
            continue

        if state != "good":
            output.write(create_msg(good=last_good, bad=d, **kwargs))
            output.write("\n")

@primedgenerator
def emailer(addresses, **kwargs):
    while True:
        d, state, skip, last_good = yield()
        if skip == "skip" or state == "good":
            continue

        subject = create_subject(good=last_good, bad=d, **kwargs)
        msg = create_msg(good=last_good, bad=d, **kwargs)
        send_msg(subject, msg, addresses)

@primedgenerator
def warnings_accumulator(l, **kwargs):
    while True:
        d, state, skip, last_good = yield()
        if state != "good":
            l.append(dict(type=state,
                good=dict(
                    build_id=last_good.buildid,
                    machine_id=last_good.machine_id,
                    timestamp=last_good.timestamp,
                    time=last_good.time,
                    revision=last_good.revision,
                    value=last_good.value,
                    ),
                bad=dict(
                    build_id=d.buildid,
                    machine_id=d.machine_id,
                    timestamp=d.timestamp,
                    time=d.time,
                    revision=d.revision,
                    value=d.value,
                    )))

@primedgenerator
def grapher(basename, title):
    all_data = []
    good_data = []
    regressions = []
    bad_machines = {}

    while True:
        try:
            d, state, skip, last_good = yield()
        except GeneratorExit:
            break
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
        graphs.append({"label": "Bad Machines (%s)" % machine_id, "data": points, "lines": {"show": False}, "points": {"show": True}})

    graph_file = "%s.js" % basename
    html_file = "%s.html" % basename
    html_template = open("graph_template.html").read()

    html = html_template % dict(graph_file = os.path.basename(graph_file), title = title)
    open(html_file, "w").write(html)
    open(graph_file, "w").write("var graph_data = %s;" % simplejson.dumps(graphs))
    raise GeneratorExit

if __name__ == "__main__":
    import os, urllib, sys
    from datetime import datetime
    from optparse import OptionParser


    parser = OptionParser()
    parser.add_option("-b", "--branch", dest="branches", action="append")
    parser.add_option("-t", "--test", dest="tests", action="append")
    parser.add_option("", "--start-time", dest="start_time", type="int", help="timestamp for when we start looking at data")
    parser.add_option("-o", "--output", dest="output", help="output file")
    parser.add_option("-q", "--quiet", dest="verbosity", action="store_const", const=log.WARN)
    parser.add_option("-v", "--verbose", dest="verbosity", action="store_const", const=log.DEBUG)
    parser.add_option("-g", "--graph-dir", dest="graph_dir")
    parser.add_option("-j", "--json", dest="json", help="enable json output", action="store_true")
    parser.add_option("-e", "--email", dest="addresses", help="send notices to this email address", action="append")
    parser.add_option("-w", "--warning_history", dest="warning_history", help="file to store warning history in")

    parser.set_defaults(
            branches = [],
            tests = [],
            start_time = time.time() - 30*24*3600,
            verbosity = log.INFO,
            output = None,
            graph_dir = None,
            json = False,
            addresses = [],
            warning_history = "warning_history.pck",
            )

    options, args = parser.parse_args()

    if not options.branches:
        options.branches = ['Firefox', 'Firefox3.1', 'TraceMonkey']

    if options.output is None or options.output == "-":
        output = sys.stdout
    else:
        output = open(options.output, "w")

    log.basicConfig(level=options.verbosity, format="%(asctime)s %(message)s")

    # warning_history is a dictionary mapping (branch_name, os_name, test_name) to a list of
    # (buildids,timestamp) entries that have been warned about.
    warning_history = load_warning_history(options.warning_history, options.start_time)

    all_warnings = []

    for branch_id, branch_name, os_id, os_name, test_id, test_name in getTestSeries(options.branches, options.start_time, options.tests):
        log.info("Processing %s %s %s", branch_name, os_name, test_name)
        # Get all the test data for all machines running this combination
        data = getTestData(branch_id, os_id, test_id, options.start_time)

        update_data_with_pushdate(data)

        a = TalosAnalyzer()
        a.addData(data)

        # Hard coded for now
        fore_window = 5
        back_window = 30
        threshold = 9
        machine_threshold = 12
        machine_history_size = 4

        analysis_gen = a.analyze_t(back_window, fore_window, threshold, machine_threshold, machine_history_size)

        old_warnings = warning_history.setdefault( (branch_name, os_name, test_name), [])
        analysis_gen = history_filter(analysis_gen, options.start_time, old_warnings)

        analysis_gen = lastgood_filter(analysis_gen)
        analysis_gen = redundant_filter(analysis_gen)

        targets = []
        if not options.json:
            p = printer(output, branch_name=branch_name, branch_id=branch_id, os_name=os_name, os_id=os_id, test_name=test_name, test_id=test_id)
            targets.append(p)
        else:
            for warnings in all_warnings:
                if warnings['branch_name'] == branch_name and warnings['os_name'] == os_name and warnings['test_name'] == test_name:
                    warnings = warnings['warnings']
                    break
            else:
                warnings = []
                all_warnings.append(dict(branch_name=branch_name, os_name=os_name, test_name=test_name, warnings=warnings))
            w = warnings_accumulator(warnings)
            targets.append(w)

        if options.graph_dir:
            graph_dir = options.graph_dir
            if not os.path.exists(graph_dir):
                os.makedirs(graph_dir)
            g = grapher("%(graph_dir)s/%(branch_name)s-%(os_name)s-%(test_name)s" % locals(),
                        "%(branch_name)s %(os_name)s %(test_name)s" % locals())
            targets.append(g)

        if options.addresses:
            targets.append(emailer(options.addresses, branch_name=branch_name, branch_id=branch_id, os_name=os_name, os_id=os_id, test_name=test_name, test_id=test_id))

        send_data(analysis_gen, targets)

    if options.json:
        simplejson.dump(all_warnings, output, indent=0)

    cPickle.dump(warning_history, open(options.warning_history, "w"))

