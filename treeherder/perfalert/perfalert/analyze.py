def analyze(data):
    n = len(data)
    if n > 1:
        m = data[0]
        s = 0.0
        for i in range(1, int(n)):
            di = data[i]
            m0 = m
            m += (di-m0)/(i+1)
            s += (di-m0) * (di - m)
        variance = s / (n-1)
        avg = m
    else:
        if n == 0:
            avg = 0.0
        else:
            avg = data[0]
        variance = 0.0
    return {"avg": avg, "n": n, "variance": variance}


def calc_t(w1, w2):
    if len(w1) == 0 or len(w2) == 0:
        return 0

    s1 = analyze(w1)
    s2 = analyze(w2)

    if s1['variance'] == 0 and s2['variance'] == 0:
        return 0

    return (s2['avg'] - s1['avg']) / (((s1['variance'] / s1['n']) + (s2['variance'] / s2['n'])) ** 0.5)

class PerfDatum(object):
    __slots__ = ('testrun_id', 'machine_id', 'timestamp', 'value', 'buildid',
            'time', 'revision', 'run_number', 'last_other', 'historical_stats',
            'forward_stats')
    def __init__(self, testrun_id, machine_id, timestamp, value, buildid, time,
            revision=None):
        # Which test run was this
        self.testrun_id = testrun_id
        # Which machine is this
        self.machine_id = machine_id
        # Talos timestamp
        self.timestamp = timestamp
        # Value of this point
        self.value = value
        # Which build was this
        self.buildid = buildid
        # Date code was pushed
        self.time = time
        # What revision this data is for
        self.revision = revision

    def __cmp__(self, o):
        return cmp(
                (self.time, self.timestamp),
                (o.time, o.timestamp),
                )

    def __eq__(self, o):
        return cmp(
                (self.timestamp, self.value, self.buildid, self.machine_id),
                (o.timestamp, o.value, o.buildid, o.machine_id),
                ) == 0

    def __ne__(self, o):
        return not self == o

    def __repr__(self):
        return "<%s: %.3f, %i, %s>" % (self.buildid, self.value, self.timestamp, self.machine_id)

    def __str__(self):
        return "Build %s on %s %s %s %s" % (self.buildid, self.timestamp, self.time, self.value, self.machine_id)


class TalosAnalyzer:
    def __init__(self):
        # List of PerfDatum instances
        self.data = []
        self.machine_history = {}

        # Cache of calm points
        self.zenPoints = {}

    def addData(self, data):
        self.data.extend(data)
        for d in data:
            self.machine_history.setdefault(d.machine_id, []).append(d)

        self.data.sort()
        for d in self.machine_history.values():
            d.sort()

    def analyze_t(self, j, k, threshold, machine_threshold, machine_history_size):
        # Use T-Tests
        # Analyze test data using T-Tests, comparing data[i-j:i] to data[i:i+k]
        good_data = []

        for i in range(j, len(self.data)-k+1):
            di = self.data[i]
            jw = [d.value for d in good_data[-j:]]
            kw = [d.value for d in self.data[i:i+k]]

            my_history = self.machine_history[di.machine_id]
            my_history_index = my_history.index(di)
            my_data = [d.value for d in self.machine_history[di.machine_id][my_history_index-machine_history_size+1:my_history_index+1]]
            other_data = []
            l = len(good_data)-1
            while len(other_data) < k*2 and l > 0:
                dl = good_data[l]
                if dl.machine_id != di.machine_id:
                    other_data.insert(0, dl.value)
                l -= 1

            di.historical_stats = analyze(jw)
            di.forward_stats = analyze(kw)

            if len(jw) >= j:
                t = calc_t(jw, kw)
            else:
                # Assume it's ok, we don't have enough data
                t = 0

            if len(other_data) >= k*2 and len(my_data) >= machine_history_size:
                m_t = calc_t(other_data, my_data)
            else:
                m_t = 0

            if abs(m_t) >= machine_threshold:
                l = len(good_data)-1
                while l >= 0:
                    dl = good_data[l]
                    if dl.machine_id != di.machine_id:
                        di.last_other = dl
                        break
                    l -= 1
                # We think this machine is bad, so don't add its data to the
                # set of good data
                yield di, "machine"
            elif abs(t) <= threshold:
                good_data.append(di)
                yield di, "good"
            else:
                # By including the data point as part of the "good" data, we slowly
                # adjust to the new baseline.
                good_data.append(di)
                yield di, "regression"
