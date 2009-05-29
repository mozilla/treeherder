import csv, datetime, time, os

def analyze(data):
    s = sum(data)
    n = len(data)
    avg = s / float(n)
    variance = sum((d - avg) ** 2.0 for d in data) / n
    stddev = variance ** 0.5
    return {"sum": s, "avg": avg, "n": n, "stddev": stddev, "variance": variance}

def calc_t(w1, w2):
    if len(w1) == 0 or len(w2) == 0:
        return 0

    s1 = analyze(w1)
    s2 = analyze(w2)

    if s1['variance'] == 0 and s2['variance'] == 0:
        return 0

    return (s2['avg'] - s1['avg']) / (((s1['variance'] / s1['n']) + (s2['variance'] / s2['n'])) ** 0.5)

class PerfDatum:
    def __init__(self, machine_id, timestamp, value, buildid, time, revision=None):
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
                (o.time, o.timestamp)
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

    def findZen(self, i, window, threshold):
        """Find the point before i where we seem to be calm"""
        if i < 0:
            i += len(self.data)

        # Find j < i such that data[j-window:j] are all within threshold (expressed as a multiplier of the avg(data[j-window:j])
        # of avg(data[j-window:j])
        j = i - 1
        while j > window:
            if (j, window, threshold) in self.zenPoints:
                return self.zenPoints[(j, window, threshold)]

            data = [d.value for d in self.data[j-window:j]]
            stats = analyze(data)
            stddev = stats['stddev']
            avg = stats['avg']
            thresh = stddev * threshold
            if any( (abs(d-avg) > thresh) for d in data ):
                j -= 1
            else:
                break
        self.zenPoints[(i, window, threshold)] = j
        return j

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

            t = calc_t(jw, kw)

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
                yield di, "machine"
            elif abs(t) <= threshold:
                good_data.append(di)
                yield di, "good"
            else:
                #print di, t, di.revision, di.value
                # TODO: nice juicy comment explaining why we do this
                good_data.append(di)
                yield di, "regression"

    def analyze(self, window, threshold):
        """Analyzes all the data with the given window and threshold.

        Yields an annotated data series of 2-tuples:
            PerfDatum, State

        where State is one of:
            "good"       - this is good datum
            "spike"      - not enough data to make a determination about this datum
            "regression" - this looks like a code regression
            "machine"    - this looks like something wrong with a particular machine
        """
        bad_count = 0
        bad_threshold = 3
        bad_direction = 0

        bad_machine_threshold = 3

        machine_history = {}
        for i in range(window+1, len(self.data)):
            di = self.data[i]
            j = self.findZen(i, window, threshold)
            data = [d.value for d in self.data[j-window:j]]
            stats = analyze(data)
            avg = stats['avg']
            stddev = stats['stddev']
            thresh = stddev * threshold
            machine_history.setdefault(di.machine_id, [])
            if abs(di.value - avg) <= thresh:
                yield di, "good"
                bad_count = 0
                bad_direction = 0
                machine_history[di.machine_id].append((di, True))
                machine_history[di.machine_id] = machine_history[di.machine_id][-bad_machine_threshold:]
            else:
                machine_history[di.machine_id].append((di, False))
                machine_history[di.machine_id] = machine_history[di.machine_id][-bad_machine_threshold:]
                v = di.value - avg
                if v > 0:
                    if bad_direction == 1:
                        bad_count += 1
                    else:
                        bad_count = 1
                        bad_direction = 1
                else:
                    if bad_direction == -1:
                        bad_count += 1
                    else:
                        bad_count = 1
                        bad_direction = -1

                if bad_count >= bad_threshold:
                    yield di, "regression"
                elif all(not good for (item, good) in machine_history[di.machine_id][-bad_machine_threshold:]):
                    yield di, "machine"
                else:
                    yield di, "spike"
