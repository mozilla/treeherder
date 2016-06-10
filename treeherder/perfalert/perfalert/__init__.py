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


class Datum(object):
    def __init__(self, push_timestamp, value, testrun_timestamp=None,
                 testrun_id=None, revision_id=None, state='good'):
        # Date code was pushed
        self.push_timestamp = push_timestamp
        # Value of this point
        self.value = value

        # Which test run was this
        self.testrun_id = testrun_id
        # What revision this data is for
        self.revision_id = revision_id

        # t-test score
        self.t = 0
        # Whether a perf regression is found
        self.state = state

    def __cmp__(self, o):
        # only compare value to make sorting deterministic
        # in cases where we have multiple datapoints with
        # the same push timestamp
        return cmp(
            (self.push_timestamp, self.testrun_id, self.value),
            (o.push_timestamp, o.testrun_id, o.value),
        )

    def __repr__(self):
        return "<%s: %s, %s, %.3f, %.3f, %s>" % (self.push_timestamp,
                                                 self.revision_id,
                                                 self.testrun_id, self.value,
                                                 self.t, self.state)


def detect_changes(data=[], min_back_window=12, max_back_window=24, 
                   fore_window=12, t_threshold=7):
    # Use T-Tests
    # Analyze test data using T-Tests, comparing data[i-j:i] to data[i:i+k]
    (j, k) = (min_back_window, fore_window)
    good_data = []

    num_points = len(data) - k + 1
    last_seen_regression = 0
    for i in range(num_points):
        di = data[i]
        # if we haven't seen something that looks like a change in a
        # while, incorporate some extra historical data into our t-test
        # calculation
        if last_seen_regression > min_back_window:
            additional_back_window = min(last_seen_regression,
                                         max_back_window - min_back_window)
        else:
            additional_back_window = 0
        jw = [d.value for d in good_data[-1 * (j + additional_back_window):]]
        kw = [d.value for d in data[i:i+k]]

        # Reverse the backward data so that the current point is at the
        # start of the window.
        jw.reverse()

        di.historical_stats = analyze(jw)
        di.forward_stats = analyze(kw)

        if len(jw) >= min_back_window:
            di.t = abs(calc_t(jw, kw, linear_weights))
            # add additional historical data points next time if we
            # haven't detected a likely regression
            if di.t > t_threshold:
                last_seen_regression = 0
            else:
                last_seen_regression += 1
        else:
            # Assume it's ok, we don't have enough data
            di.t = 0

        good_data.append(di)

    # Now that the t-test scores are calculated, go back through the data to
    # find where changes most likely happened.
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
    return data[1:num_points-1]
