from treeherder.perf.methods.BaseDetector import BaseDetector


class StudentDetector(BaseDetector):
    def calc_confidence(
        self, w1, w2, confidence_threshold, last_seen_regression, replicates_enabled
    ):
        # replaces calc_t function
        """Perform a Students t-test on the two sets of revision data.

        See the analyze() function for a description of the `weight_fn` argument.
        """
        if not w1 or not w2:
            confidence = 0
        else:
            s1 = self.analyze(w1, replicates_enabled, self.linear_weights)
            s2 = self.analyze(w2, replicates_enabled, self.linear_weights)
            delta_s = s2["avg"] - s1["avg"]

            if delta_s == 0:
                confidence = 0
            elif s1["variance"] == 0 and s2["variance"] == 0:
                confidence = float("inf")
            else:
                confidence = delta_s / (
                    ((s1["variance"] / s1["n"]) + (s2["variance"] / s2["n"])) ** 0.5
                )
        if confidence > confidence_threshold:
            last_seen_regression = 0
        else:
            last_seen_regression += 1

        return confidence, last_seen_regression
