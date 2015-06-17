# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
import logging as log
try:
    import simplejson as json
except ImportError:
    import json

import urllib
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

    def getTestSeries(self, branches, test_names):
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
        for test_id, test in tests['testMap'].items():
            test_name = test['name']
            if test_names and test_name not in test_names:
                continue

            for branch_id in test['branchIds']:
                branch_info = tests['branchMap'][str(branch_id)]
                if branch_info['name'] not in branches or str(branch_id) not in tests['branchMap']:
                    continue

                for os_id in test['platformIds']:
                    if str(os_id) not in tests['platformMap']:
                        continue
                    os_info = tests['platformMap'][str(os_id)]

                    # Skip NoChrome tests
                    if "NoChrome" in test_name:
                        continue

                    # Skip Fast Cycle tests
                    if "Fast Cycle" in test_name:
                        continue

                    series = TestSeries(branch_id, branch_info['name'],
                                        os_id, os_info['name'],
                                        test_id, test_name)
                    if series not in retval:
                        retval.append(series)

        return retval

    def getTestData(self, series):
        base = self.baseurl
        retval = []
        seen = {}
        test_id = series.test_id
        branch_id = series.branch_id
        os_id = series.os_id
        url = "%(base)s/test/runs?id=%(test_id)s&branchid=%(branch_id)s&platformid=%(os_id)s" % locals()
        try:
            log.debug("Getting %s", url)
            req = urllib.urlopen(url)
            results = json.load(req)
        except KeyboardInterrupt:
            raise
        except:
            log.exception("Couldn't load or parse %s", url)
            return []

        if 'test_runs' not in results:
            log.debug("No data from %s", url)
            return []

        for item in results['test_runs']:
            testrunid, build, date, average, run_number, annotations, machine_id, row_geo = item
            if average is None:
                continue

            d = PerfDatum(testrunid, machine_id, date, average, build[1], date, build[2])
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

        # TODO: emulate methods getMachinesForTest and getMachineName from analyze_db
