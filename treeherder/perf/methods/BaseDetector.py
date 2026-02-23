from abc import ABC, abstractmethod
from collections import namedtuple

from django.db import transaction

from treeherder.perf.models import PerformanceSignature


class BaseDetector(ABC):
    """
    A base class that other classes can inherit from.
    """

    def __init__(
        self,
        name,
        min_back_window,
        max_back_window,
        fore_window,
        magnitude_threshold,
        confidence_threshold,
        mag_check,
        above_threshold_is_anomaly,
    ):
        """Initialize the base class."""
        self.name = name
        self.min_back_window = min_back_window
        self.max_back_window = max_back_window
        self.fore_window = fore_window
        self.magnitude_threshold = magnitude_threshold
        self.confidence_threshold = confidence_threshold
        self.mag_check = mag_check
        self.above_threshold_is_anomaly = above_threshold_is_anomaly

    def default_weights(self, i, n):
        """A window function that weights all points uniformly."""
        return 1.0

    def linear_weights(self, i, n):
        """A window function that falls off arithmetically.

        This is used to calculate a weighted moving average (WMA) that gives higher
        weight to changes near the point being analyzed, and smooth out changes at
        the opposite edge of the moving window.  See bug 879903 for details.
        """
        if i >= n:
            return 0.0
        return float(n - i) / float(n)

    @abstractmethod
    def calc_confidence(self, jw, kw, confidence_threshold, last_seen_regression):
        # replaces calc_t function
        """
        Abstract method that must be implemented by subclasses to calculate confidence (p-value or T-value).
        """
        pass

    def check_threshold(self, confidence, confidence_threshold, above_threshold_is_anomaly):
        """
        Abstract method that must be implemented by subclasses to check threshold.
        """
        if above_threshold_is_anomaly:
            return confidence <= confidence_threshold
        else:
            return confidence >= confidence_threshold

    def check_adjacent_points(self, entry_1, entry_2, above_threshold_is_anomaly):
        """
        Check if adjacent points meet the threshold condition.
        """
        if above_threshold_is_anomaly:
            return entry_1.confidence[self.name] > entry_2.confidence[self.name]
        else:
            return entry_1.confidence[self.name] < entry_2.confidence[self.name]

    def analyze(self, revision_data, weight_fn=None):
        """Returns the average and sample variance (s**2) of a list of floats.

        `weight_fn` is a function that takes a list index and a window width, and
        returns a weight that is used to calculate a weighted average.  For example,
        see `default_weights` or `linear_weights` below.  If no function is passed,
        `default_weights` is used and the average will be uniformly weighted.
        """
        if weight_fn is None:
            weight_fn = self.default_weights

        # get a weighted average for the full set of data -- this is complicated
        # by the fact that we might have multiple data points from each revision
        # which we would want to weight equally -- do this by creating a set of
        # weights only for each bucket containing (potentially) multiple results
        # for each value
        num_revisions = len(revision_data)
        weights = [weight_fn(i, num_revisions) for i in range(num_revisions)]
        weighted_sum = 0
        sum_of_weights = 0
        for i in range(num_revisions):
            weighted_sum += sum(value * weights[i] for value in revision_data[i].values)
            sum_of_weights += weights[i] * len(revision_data[i].values)
        weighted_avg = weighted_sum / sum_of_weights if num_revisions > 0 else 0.0

        # now that we have a weighted average, we can calculate the variance of the
        # whole series
        all_data = [v for datum in revision_data for v in datum.values]
        variance = (
            (sum(pow(d - weighted_avg, 2) for d in all_data) / (len(all_data) - 1))
            if len(all_data) > 1
            else 0.0
        )

        return {"avg": weighted_avg, "n": len(all_data), "variance": variance}

    def get_alert_properties(self, prev_value, new_value, lower_is_better):
        AlertProperties = namedtuple(
            "AlertProperties", "pct_change delta is_regression prev_value new_value"
        )
        if prev_value != 0:
            pct_change = 100.0 * abs(new_value - prev_value) / float(prev_value)
        else:
            pct_change = 0.0

        delta = new_value - prev_value

        is_regression = (delta > 0 and lower_is_better) or (delta < 0 and not lower_is_better)

        return AlertProperties(pct_change, delta, is_regression, prev_value, new_value)

    def check_magnitude_of_change(self, signature, analyzed_series, magnitude_threshold):
        with transaction.atomic():
            for cur in range(len(analyzed_series[1:])):
                curr_series = analyzed_series[cur]
                if curr_series.change_detected:
                    prev_value = curr_series.historical_stats["avg"]
                    new_value = curr_series.forward_stats["avg"]
                    alert_properties = self.get_alert_properties(
                        prev_value, new_value, signature.lower_is_better
                    )
                    # ignore regressions below the configured regression
                    # threshold
                    if (
                        (
                            signature.alert_change_type is None
                            or signature.alert_change_type == PerformanceSignature.ALERT_PCT
                        )
                        and alert_properties.pct_change < magnitude_threshold
                    ) or (
                        signature.alert_change_type == PerformanceSignature.ALERT_ABS
                        and abs(alert_properties.delta) < magnitude_threshold
                    ):
                        analyzed_series[cur].change_detected = False
        return analyzed_series

    def detect_changes(self, data, signature):
        min_back_window = signature.min_back_window
        if min_back_window is None:
            min_back_window = self.min_back_window
        max_back_window = signature.max_back_window
        if max_back_window is None:
            max_back_window = self.max_back_window
        fore_window = signature.fore_window
        if fore_window is None:
            fore_window = self.fore_window
        magnitude_threshold = signature.alert_threshold
        if magnitude_threshold is None:
            magnitude_threshold = self.magnitude_threshold
        confidence_threshold = self.confidence_threshold
        mag_check = self.mag_check
        above_threshold_is_anomaly = self.above_threshold_is_anomaly

        data = sorted(data)

        last_seen_regression = 0
        for i in range(1, len(data)):
            di = data[i]

            # keep on getting previous data until we've either got at least 12
            # data points *or* we've hit the maximum back window
            jw = []
            di.amount_prev_data = 0
            prev_indice = i - 1
            while (
                di.amount_prev_data < max_back_window
                and prev_indice >= 0
                and (
                    (i - prev_indice)
                    <= min(max(last_seen_regression, min_back_window), max_back_window)
                )
            ):
                jw.append(data[prev_indice])
                di.amount_prev_data += len(jw[-1].values)
                prev_indice -= 1

            # accumulate present + future data until we've got at least 12 values
            kw = []
            di.amount_next_data = 0
            next_indice = i
            while di.amount_next_data < fore_window and next_indice < len(data):
                kw.append(data[next_indice])
                di.amount_next_data += len(kw[-1].values)
                next_indice += 1

            di.historical_stats = self.analyze(jw)
            di.forward_stats = self.analyze(kw)

            di.confidence[self.name], last_seen_regression = self.calc_confidence(
                jw, kw, confidence_threshold, last_seen_regression
            )

        # Now that the t-test scores are calculated, go back through the data to
        # find where changes most likely happened.
        for i in range(1, len(data)):
            di = data[i]
            # if we don't have enough data yet, skip for now (until more comes
            # in)
            if di.amount_prev_data < min_back_window or di.amount_next_data < fore_window:
                continue

            if self.check_threshold(
                di.confidence[self.name], confidence_threshold, above_threshold_is_anomaly
            ):
                continue

            # Check the adjacent points
            prev = data[i - 1]

            if self.check_adjacent_points(prev, di, above_threshold_is_anomaly):
                continue
            # next may or may not exist if it's the last in the series
            if (i + 1) < len(data):
                next = data[i + 1]
                if self.check_adjacent_points(next, di, above_threshold_is_anomaly):
                    continue

            # This datapoint has a t value higher than the threshold and higher
            # than either neighbor.  Mark it as the cause of a regression.
            di.change_detected = True
        if mag_check:
            data = self.check_magnitude_of_change(signature, data, magnitude_threshold)
        return data
