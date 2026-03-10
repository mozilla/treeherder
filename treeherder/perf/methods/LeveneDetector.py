from scipy import stats

from treeherder.perf.methods.BaseDetector import BaseDetector


class LeveneDetector(BaseDetector):
    """
    Detector using Levene's test (tests for equal variances).
    """

    def calc_confidence(
        self, jw, kw, confidence_threshold, last_seen_regression, replicates_enabled
    ):
        """
        Calculate Levene's test statistic and p-value.
        """
        source_attr = "replicates" if replicates_enabled else "values"

        jw_values = [v for datum in jw for v in getattr(datum, source_attr)]
        kw_values = [v for datum in kw for v in getattr(datum, source_attr)]

        if len(jw_values) < 2 or len(kw_values) < 2:
            return 1.0, last_seen_regression + 1

        try:
            result = stats.levene(jw_values, kw_values)
            p = result.pvalue
        except Exception:
            p = 1.0

        if p < confidence_threshold:
            last_seen_regression = 0
        else:
            last_seen_regression += 1

        return p, last_seen_regression
