"use strict";

treeherder.factory('math', [
    function() {
        function percentOf(a, b) {
            return b ? 100 * a / b : 0;
        }

        function average(values) {
            if (values.length < 1) {
                return 0;
            }

            return _.sum(values) / values.length;

        }

        function stddev(values, avg) {
            if (values.length < 2) {
                return undefined;
            }

            if (!avg)
                avg = average(values);

            return Math.sqrt(
                values.map(function (v) { return Math.pow(v - avg, 2); })
                    .reduce(function (a, b) { return a + b; }) / (values.length - 1));
        }

        // If a set has only one value, assume average-ish-plus sddev, which
        // will manifest as smaller t-value the less items there are at the group
        // (so quite small for 1 value). This default value is a parameter.
        // C/T mean control/test group (in our case original/new data).
        function t_test(valuesC, valuesT, stddev_default_factor) {
            var lenC = valuesC.length,
                lenT = valuesT.length;

            // We must have at least one value at each set
            if (lenC < 1 || lenT < 1) {
                return 0;
            }

            var avgC = average(valuesC);
            var avgT = average(valuesT);

            // Use actual stddev if possible, or stddev_default_factor if one sample
            var stddevC = (lenC > 1 ? stddev(valuesC, avgC) : stddev_default_factor * avgC),
                stddevT = (lenT > 1 ? stddev(valuesT, avgT) : stddev_default_factor * avgT);

            // If one of the sets has only a single sample, assume its stddev is
            // the same as that of the other set (in percentage). If both sets
            // have only one sample, both will use stddev_default_factor.
            if (lenC === 1) {
                stddevC = valuesC[0] * stddevT / avgT;
            } else if (lenT === 1) {
                stddevT = valuesT[0] * stddevC / avgC;
            }

            var delta = avgT - avgC;
            var stdDiffErr = (
                Math.sqrt(
                    stddevC * stddevC / lenC // control-variance / control-size
                        +
                        stddevT * stddevT / lenT // ...
                )
            );

            return delta / stdDiffErr;
        }

        return {
            percentOf: percentOf,
            average: average,
            stddev: stddev,
            t_test: t_test
        };
    }]);
