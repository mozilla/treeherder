import logging as log
try:
    import simplejson as json
except ImportError:
    import json

import urllib, os, sys

from analyze import PerfDatum

class TestSeries:
    def __init__(self, branch_id, branch_name, os_id, os_name, test_id, test_name):
        self.branch_id = branch_id
        self.branch_name = branch_name
        self.os_id = os_id
        self.os_name = os_name
        self.test_id = test_id
        self.test_name = test_name

    def __eq__(self, o):
        return (self.branch_id, self.os_id, self.test_id) == (o.branch_id, o.os_id, o.test_id)

    def __hash__(self):
        return hash((self.branch_id, self.os_id, self.test_id))

class GraphAPISource:
    def __init__(self, baseurl):
        self.baseurl = baseurl

    def getTestSeries(self, branches, start_date, test_names):
        url = "%s/%s" % (self.baseurl, "test")
        try:
            log.debug("Getting %s", url)
            req = urllib.urlopen(url)
            tests = json.load(req)
        except KeyboardInterrupt:
            raise
        except:
            log.exception("Couldn't load or parse %s", url)
            return []

        if tests['stat'] != "ok":
            log.warn("Test status not ok: %s", tests['stat'])
            return []

        retval = []
        machines_by_branch = {}
        machine_names = {}
        for test in tests['tests']:
            machine_info = test['machine']
            machine_id = machine_info['id']
            machine_name = machine_info['name']
            os_info = test['os']
            os_id = os_info['id']
            branch_info = test['branch']
            branch_id = branch_info['id']
            if branch_info['name'] not in branches:
                continue

            test_id = test['id']
            test_name = test['name']

            if test_names and test_name not in test_names:
                continue

            # Skip NoChrome tests
            if "NoChrome" in test_name:
                continue

            # Skip Fast Cycle tests
            if "Fast Cycle" in test_name:
                continue

            # Skip GFX
            if "GFX" in test_name:
                continue

            series = TestSeries(branch_id, branch_info['name'],
                           os_id, os_info['name'],
                           test_id, test_name)
            if series not in retval:
                retval.append(series)

            if series not in machines_by_branch:
                machines_by_branch[series] = []
            if machine_id not in machines_by_branch[series]:
                machines_by_branch[series].append(machine_id)
            if machine_id not in machine_names:
                machine_names[machine_id] = machine_info['name']
        self.machines_by_branch = machines_by_branch
        self.machine_names = machine_names
        return retval

    def getTestData(self, series, start_time):
        base = self.baseurl
        retval = []
        seen = {}
        for machine_id in self.machines_by_branch[series]:
            test_id = series.test_id
            branch_id = series.branch_id
            machine_id = machine_id
            url = "%(base)s/test/runs?id=%(test_id)s&branchid=%(branch_id)s&machineid=%(machine_id)s" % locals()
            try:
                log.debug("Getting %s", url)
                req = urllib.urlopen(url)
                results = json.load(req)
            except KeyboardInterrupt:
                raise
            except:
                log.exception("Couldn't load or parse %s", url)
                continue

            if 'test_runs' not in results:
                log.debug("No data from %s", url)
                continue

            for item in results['test_runs']:
                testrunid, build, date, average, run_number, annotations = item
                if average is None:
                    continue
                d = PerfDatum(machine_id, date, average, build[1], date, build[2])
                d.run_number = run_number
                retval.append(d)
                t = (d.buildid, date, average, machine_id)
                #if t in seen:
                    #if seen[t].run_number == run_number:
                        #continue
                    #log.error("%s %s %s", seen[t], seen[t].machine_id, seen[t].run_number)
                    #log.error("%s %s %s", d, d.machine_id, d.run_number)
                    #log.error(url)
                #else:
                    #seen[t] = d

        return retval

    def getMachinesForTest(self, series):
        return self.machines_by_branch[series]

    def getMachineName(self, machine_id):
        return self.machine_names[machine_id]
