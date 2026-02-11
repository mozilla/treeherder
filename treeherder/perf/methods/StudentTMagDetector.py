from treeherder.perf.methods.BaseDetector import BaseDetector
from scipy import stats

class StudentTMagDetector(BaseDetector):


    def __init__(self, name="studenttmag",min_back_window=12, max_back_window=24, fore_window=12,
                 alert_threshold=2.0, alpha_threshold=7, mag_check=True, above_threshold_is_anomaly=True):
        super().__init__(
            name=name,
            min_back_window=min_back_window,
            max_back_window=max_back_window,
            fore_window=fore_window,
            alert_threshold=alert_threshold,
            alpha_threshold=alpha_threshold,
            mag_check=mag_check,
            above_threshold_is_anomaly=above_threshold_is_anomaly
        )


    def calc_alpha(self, w1, w2, alpha_threshold, last_seen_regression):
        # replaces calc_t function
        """Perform a Students t-test on the two sets of revision data.

        See the analyze() function for a description of the `weight_fn` argument.
        """
        if not w1 or not w2:
            t = 0
        else:
            s1 = self.analyze(w1, self.linear_weights)
            s2 = self.analyze(w2, self.linear_weights)
            delta_s = s2["avg"] - s1["avg"]

            if delta_s == 0:
                t =   0
            elif s1["variance"] == 0 and s2["variance"] == 0:
                t =  float("inf")
            else:
                t =  delta_s / (((s1["variance"] / s1["n"]) + (s2["variance"] / s2["n"])) ** 0.5)
        if t > alpha_threshold:
            last_seen_regression = 0
        else:
            last_seen_regression += 1
        
        return t, last_seen_regression
