def analyze(data, weight_fn=None):
    """Returns the average and sample variance (s**2) of a list of floats.

    `weight_fn` is a function that takes a list index and a window width, and
    returns a weight that is used to calculate a weighted average.  For example,
    see `default_weights` or `linear_weights` below.  If no function is passed,
    `default_weights` is used and the average will be uniformly weighted.
    """
    if weight_fn is None:
        weight_fn = default_weights

    n = len(data)
    weights = [weight_fn(i, n) for i in range(n)]
    weighted_sum = sum(data[i] * weights[i] for i in range(n))
    weighted_avg = weighted_sum / sum(weights) if n > 0 else 0.0

    variance = (sum(pow(d-weighted_avg, 2) for d in data) / (n-1)) if n > 1 else 0.0
    return {"avg": weighted_avg, "n": n, "variance": variance}


def default_weights(i, n):
    """A window function that weights all points uniformly."""
    return 1.0


def linear_weights(i, n):
    """A window function that falls off arithmetically.

    This is used to calculate a weighted moving average (WMA) that gives higher
    weight to changes near the point being analyzed, and smooth out changes at
    the opposite edge of the moving window.  See bug 879903 for details.
    """
    if i >= n:
        return 0.0
    return float(n - i) / float(n)


def calc_t(w1, w2, weight_fn=None):
    """Perform a Students t-test on the two lists of data.

    See the analyze() function for a description of the `weight_fn` argument.
    """
    if len(w1) == 0 or len(w2) == 0:
        return 0

    s1 = analyze(w1, weight_fn)
    s2 = analyze(w2, weight_fn)
    delta_s = s2['avg'] - s1['avg']

    if delta_s == 0:
        return 0
    if s1['variance'] == 0 and s2['variance'] == 0:
        return float('inf')

    return delta_s / (((s1['variance'] / s1['n']) + (s2['variance'] / s2['n'])) ** 0.5)


class PerfDatum(object):
    def __init__(self, push_timestamp, value, testrun_timestamp=None,
                 buildid=None, testrun_id=None, machine_id=None,
                 revision=None, state='good'):
        # Date code was pushed
        self.push_timestamp = push_timestamp
        # Value of this point
        self.value = value

        # Which build was this
        self.buildid = buildid
        # timestamp when test was run
        if testrun_timestamp:
            self.testrun_timestamp = testrun_timestamp
        else:
            # in some cases we may not have information on when test was run
            # in that case just pretend its the same as when it was pushed
            self.testrun_timestamp = push_timestamp
        # Which test run was this
        self.testrun_id = testrun_id
        # Which machine is this
        self.machine_id = machine_id
        # What revision this data is for
        self.revision = revision

        # t-test score
        self.t = 0
        # Whether a machine issue or perf regression is found
        self.state = state

    def __cmp__(self, o):
        return cmp(
                (self.push_timestamp, self.testrun_timestamp),
                (o.push_timestamp, o.testrun_timestamp),
                )

    def __eq__(self, o):
        return cmp(
                (self.testrun_timestamp, self.value, self.buildid, self.machine_id),
                (o.testrun_timestamp, o.value, o.buildid, o.machine_id),
                ) == 0

    def __ne__(self, o):
        return not self == o

    def __repr__(self):
        return "<%s: %.3f, %i, %s>" % (self.buildid, self.value,
                                       self.testrun_timestamp, self.machine_id)

    def __str__(self):
        return "Build %s on %s %s %s %s" % (self.buildid,
                                            self.testrun_timestamp,
                                            self.push_timestamp, self.value,
                                            self.machine_id)


class Analyzer:
    def __init__(self):
        # List of PerfDatum instances
        self.data = []
        self.machine_history = {}

    def addData(self, data):
        self.data.extend(data)
        for d in data:
            self.machine_history.setdefault(d.machine_id, []).append(d)

        self.data.sort()
        for d in self.machine_history.values():
            d.sort()

    def analyze_t(self, back_window=12, fore_window=12, t_threshold=7,
                  machine_threshold=None, machine_history_size=None):
        # Use T-Tests
        # Analyze test data using T-Tests, comparing data[i-j:i] to data[i:i+k]
        (j, k) = (back_window, fore_window)
        good_data = []

        num_points = len(self.data) - k + 1
        for i in range(num_points):
            di = self.data[i]
            jw = [d.value for d in good_data[-j:]]
            kw = [d.value for d in self.data[i:i+k]]

            # Reverse the backward data so that the current point is at the
            # start of the window.
            jw.reverse()

            di.historical_stats = analyze(jw)
            di.forward_stats = analyze(kw)

            if len(jw) >= j:
                di.t = abs(calc_t(jw, kw, linear_weights))
            else:
                # Assume it's ok, we don't have enough data
                di.t = 0

            if machine_threshold is None:
                good_data.append(di)
            else:
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

                if len(other_data) >= k*2 and len(my_data) >= machine_history_size:
                    m_t = calc_t(other_data, my_data, linear_weights)
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
                    di.state = 'machine'
                else:
                    good_data.append(di)

        # Now that the t-test scores are calculated, go back through the data to
        # find where regressions most likely happened.
        for i in range(1, len(good_data) - 1):
            di = good_data[i]
            if di.t <= t_threshold:
                continue

            # Check the adjacent points
            prev = good_data[i-1]
            if prev.t > di.t:
                continue
            next = good_data[i+1]
            if next.t > di.t:
                continue

            # This datapoint has a t value higher than the threshold and higher
            # than either neighbor.  Mark it as the cause of a regression.
            di.state = 'regression'

        # Return all but the first and last points whose scores we calculated,
        # since we can only produce a final decision for a point whose scores
        # were compared to both of its neighbors.
        return self.data[1:num_points-1]
