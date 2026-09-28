import unittest

import responses

from treeherder.client.thclient import (
    PerformanceSeries,
    PerformanceSignatureCollection,
    PerformanceTimeInterval,
    PerfherderClient,
)


class PerfherderClientTest(unittest.TestCase):
    @responses.activate
    def test_get_performance_signatures(self):
        pc = PerfherderClient()
        url = pc._get_endpoint_url(pc.PERFORMANCE_SIGNATURES_ENDPOINT, project="mozilla-central")
        content = {
            "signature1": {"cheezburgers": 1},
            "signature2": {"hamburgers": 2},
            "signature3": {"cheezburgers": 2},
        }
        responses.add(responses.GET, url, json=content, status=200)

        sigs = pc.get_performance_signatures("mozilla-central")
        self.assertEqual(len(sigs), 3)
        self.assertEqual(sigs.get_signature_hashes(), ["signature1", "signature2", "signature3"])
        self.assertEqual(sigs.get_property_names(), set(["cheezburgers", "hamburgers"]))
        self.assertEqual(sigs.get_property_values("cheezburgers"), set([1, 2]))

    @responses.activate
    def test_get_performance_data(self):
        pc = PerfherderClient()

        url = "{}?{}".format(
            pc._get_endpoint_url(pc.PERFORMANCE_DATA_ENDPOINT, project="mozilla-central"),
            "signatures=signature1&signatures=signature2",
        )
        content = {
            "signature1": [{"value": 1}, {"value": 2}],
            "signature2": [{"value": 2}, {"value": 1}],
        }
        responses.add(responses.GET, url, json=content, status=200)

        series_list = pc.get_performance_data(
            "mozilla-central", signatures=["signature1", "signature2"]
        )
        self.assertEqual(len(series_list), 2)
        self.assertEqual(series_list["signature1"]["value"], [1, 2])
        self.assertEqual(series_list["signature2"]["value"], [2, 1])

    def test_performance_signature_collection_filter(self):
        raw_signatures = {
            "sig1": {"suite": "tp5o", "machine_platform": "win10", "framework": 1},
            "sig2": {"suite": "tp5o", "machine_platform": "linux64", "framework": 1},
            "sig3": {"suite": "dromaeo", "machine_platform": "win10", "framework": 2},
        }
        collection = PerformanceSignatureCollection(raw_signatures)

        # Filter with one matching tuple and one excluding tuple
        filtered = collection.filter(("suite", "tp5o"), ("machine_platform", "win10"))

        self.assertIsInstance(filtered, PerformanceSignatureCollection)
        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered.get("sig1"), raw_signatures["sig1"])
        self.assertIsNone(filtered.get("sig2"))

        items = list(filtered.items())
        self.assertEqual(items, [("sig1", raw_signatures["sig1"])])

        self.assertEqual(filtered.get_signature_hashes(), ["sig1"])
        self.assertEqual(
            filtered.get_property_names(),
            set(["suite", "machine_platform", "framework"]),
        )

    def test_performance_series_column_access(self):
        data = [
            {"value": 10.5, "push_id": 100, "geomean": 5.2},
            {"value": 12.0, "push_id": 101, "geomean": 6.1},
        ]
        series = PerformanceSeries(data)

        self.assertEqual(series["value"], [10.5, 12.0])
        self.assertEqual(series["push_id"], [100, 101])
        self.assertEqual(series["geomean"], [5.2, 6.1])

    def test_performance_time_interval_valid_time_intervals(self):
        intervals = PerformanceTimeInterval.all_valid_time_intervals()

        self.assertEqual(
            intervals,
            [
                PerformanceTimeInterval.DAY,
                PerformanceTimeInterval.WEEK,
                PerformanceTimeInterval.TWO_WEEKS,
                PerformanceTimeInterval.SIXTY_DAYS,
                PerformanceTimeInterval.NINETY_DAYS,
                PerformanceTimeInterval.ONE_YEAR,
            ],
        )
        self.assertEqual(
            intervals,
            [86400, 604800, 1209600, 5184000, 7776000, 31536000],
        )
        self.assertEqual(PerformanceTimeInterval.DAY, 86400)
        self.assertEqual(PerformanceTimeInterval.WEEK, 604800)
        self.assertEqual(PerformanceTimeInterval.TWO_WEEKS, 1209600)
        self.assertEqual(PerformanceTimeInterval.SIXTY_DAYS, 5184000)
        self.assertEqual(PerformanceTimeInterval.NINETY_DAYS, 7776000)
        self.assertEqual(PerformanceTimeInterval.ONE_YEAR, 31536000)


if __name__ == "__main__":
    unittest.main()
