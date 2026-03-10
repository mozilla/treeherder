from scipy import stats

from treeherder.perf.methods.BaseDetector import BaseDetector


class CramerVonMisesDetector(BaseDetector):
    """
    Detector using Cramér-von Mises test.
    """

    def calc_confidence(self, jw, kw, confidence_threshold, confidence, replicates_enabled):
        """
        Calculate Cramér-von Mises test statistic and p-value.
        """
        source_attr = "replicates" if replicates_enabled else "values"

        jw_values = [v for datum in jw for v in getattr(datum, source_attr)]
        kw_values = [v for datum in kw for v in getattr(datum, source_attr)]

        if len(jw_values) < 2 or len(kw_values) < 2:
            return 1.0, confidence + 1

        try:
            result = stats.cramervonmises_2samp(jw_values, kw_values)
            p = result.pvalue
        except Exception:
            p = 1.0

        if p < confidence_threshold:
            confidence = 0
        else:
            confidence += 1

        return p, confidence
