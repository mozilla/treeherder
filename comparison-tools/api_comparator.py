#!/usr/bin/env python3
"""
Treeherder API Comparison Tool
Compares API responses between local and staging environments
"""

import argparse
import difflib
import json
import sys
import time
from dataclasses import asdict, dataclass
from datetime import datetime
from urllib.parse import urljoin

import requests


@dataclass
class ComparisonResult:
    endpoint: str
    local_status: int
    staging_status: int
    local_response_time: float
    staging_response_time: float
    data_matches: bool
    differences: list[str]
    local_size: int
    staging_size: int
    timestamp: str


class TreeherderAPIComparator:
    def __init__(
        self,
        local_base_url: str = "http://localhost:8000",
        staging_base_url: str = "https://treeherder.allizom.org",
    ):
        self.local_base_url = local_base_url
        self.staging_base_url = staging_base_url
        self.session = requests.Session()
        self.session.headers.update(
            {"User-Agent": "Treeherder-API-Comparator/1.0", "Accept": "application/json"}
        )

        # Key API endpoints to compare
        self.endpoints = [
            "/api/",
            "/api/repository/",
            "/api/project/",
            "/api/optioncollectionhash/",
            "/api/failureclassification/",
            "/api/user/",
            "/api/bugzilla/",
            "/api/performance/framework/",
            "/api/performance/platform/",
            "/api/jobs/?count=10",  # Limited count for comparison
            "/api/push/?count=10",  # Limited count for comparison
        ]

    def make_request(self, base_url: str, endpoint: str) -> tuple[int, dict, float]:
        """Make HTTP request and return status, data, and response time"""
        url = urljoin(base_url, endpoint)
        start_time = time.time()

        try:
            response = self.session.get(url, timeout=30)
            response_time = time.time() - start_time

            try:
                data = response.json()
            except json.JSONDecodeError:
                data = {"error": "Invalid JSON response", "text": response.text[:500]}

            return response.status_code, data, response_time

        except requests.exceptions.RequestException as e:
            response_time = time.time() - start_time
            return 0, {"error": str(e)}, response_time

    def compare_data(self, local_data: dict, staging_data: dict) -> tuple[bool, list[str]]:
        """Compare two data structures and return differences"""
        differences = []

        # Convert to JSON strings for comparison
        local_json = json.dumps(local_data, sort_keys=True, indent=2)
        staging_json = json.dumps(staging_data, sort_keys=True, indent=2)

        if local_json == staging_json:
            return True, []

        # Generate diff
        diff = list(
            difflib.unified_diff(
                local_json.splitlines(keepends=True),
                staging_json.splitlines(keepends=True),
                fromfile="local",
                tofile="staging",
                n=3,
            )
        )

        differences = ["".join(diff)]

        # Additional structural analysis
        if isinstance(local_data, dict) and isinstance(staging_data, dict):
            local_keys = set(local_data.keys())
            staging_keys = set(staging_data.keys())

            if local_keys != staging_keys:
                missing_in_local = staging_keys - local_keys
                missing_in_staging = local_keys - staging_keys

                if missing_in_local:
                    differences.append(f"Keys missing in local: {missing_in_local}")
                if missing_in_staging:
                    differences.append(f"Keys missing in staging: {missing_in_staging}")

        return False, differences

    def compare_endpoint(self, endpoint: str) -> ComparisonResult:
        """Compare a single endpoint between local and staging"""
        print(f"Comparing {endpoint}...")

        # Get local response
        local_status, local_data, local_time = self.make_request(self.local_base_url, endpoint)

        # Get staging response
        staging_status, staging_data, staging_time = self.make_request(
            self.staging_base_url, endpoint
        )

        # Compare data
        data_matches, differences = self.compare_data(local_data, staging_data)

        return ComparisonResult(
            endpoint=endpoint,
            local_status=local_status,
            staging_status=staging_status,
            local_response_time=local_time,
            staging_response_time=staging_time,
            data_matches=data_matches,
            differences=differences,
            local_size=len(json.dumps(local_data)),
            staging_size=len(json.dumps(staging_data)),
            timestamp=datetime.now().isoformat(),
        )

    def run_comparison(self, endpoints: list[str] | None = None) -> list[ComparisonResult]:
        """Run comparison for all or specified endpoints"""
        endpoints_to_check = endpoints or self.endpoints
        results = []

        print("Starting API comparison between:")
        print(f"  Local:   {self.local_base_url}")
        print(f"  Staging: {self.staging_base_url}")
        print(f"  Endpoints: {len(endpoints_to_check)}")
        print("-" * 60)

        for endpoint in endpoints_to_check:
            try:
                result = self.compare_endpoint(endpoint)
                results.append(result)

                # Print summary
                status_match = "✓" if result.local_status == result.staging_status else "✗"
                data_match = "✓" if result.data_matches else "✗"
                print(
                    f"{endpoint:30} Status:{status_match} Data:{data_match} "
                    f"Time: {result.local_response_time:.2f}s / {result.staging_response_time:.2f}s"
                )

            except Exception as e:
                print(f"Error comparing {endpoint}: {e}")

        return results

    def generate_report(self, results: list[ComparisonResult], output_file: str = None):
        """Generate detailed comparison report"""
        report = {
            "comparison_summary": {
                "timestamp": datetime.now().isoformat(),
                "local_base_url": self.local_base_url,
                "staging_base_url": self.staging_base_url,
                "total_endpoints": len(results),
                "matching_endpoints": sum(1 for r in results if r.data_matches),
                "status_code_mismatches": sum(
                    1 for r in results if r.local_status != r.staging_status
                ),
                "avg_local_response_time": sum(r.local_response_time for r in results)
                / len(results)
                if results
                else 0,
                "avg_staging_response_time": sum(r.staging_response_time for r in results)
                / len(results)
                if results
                else 0,
            },
            "detailed_results": [asdict(result) for result in results],
        }

        if output_file:
            with open(output_file, "w") as f:
                json.dump(report, f, indent=2)
            print(f"\nDetailed report saved to: {output_file}")

        # Print summary
        print("\n" + "=" * 60)
        print("COMPARISON SUMMARY")
        print("=" * 60)
        print(f"Total endpoints checked: {report['comparison_summary']['total_endpoints']}")
        print(f"Data matches: {report['comparison_summary']['matching_endpoints']}")
        print(f"Status code mismatches: {report['comparison_summary']['status_code_mismatches']}")
        print(
            f"Avg response time - Local: {report['comparison_summary']['avg_local_response_time']:.3f}s"
        )
        print(
            f"Avg response time - Staging: {report['comparison_summary']['avg_staging_response_time']:.3f}s"
        )

        # Show problematic endpoints
        problematic = [
            r for r in results if not r.data_matches or r.local_status != r.staging_status
        ]
        if problematic:
            print(f"\nPROBLEMATIC ENDPOINTS ({len(problematic)}):")
            for result in problematic:
                print(f"  {result.endpoint}")
                if result.local_status != result.staging_status:
                    print(
                        f"    Status: Local={result.local_status}, Staging={result.staging_status}"
                    )
                if not result.data_matches:
                    print(f"    Data differs ({len(result.differences)} differences)")

        return report


def main():
    parser = argparse.ArgumentParser(description="Compare Treeherder API endpoints")
    parser.add_argument(
        "--local",
        default="http://localhost:8000",
        help="Local base URL (default: http://localhost:8000)",
    )
    parser.add_argument(
        "--staging",
        default="https://treeherder.allizom.org",
        help="Staging base URL (default: https://treeherder.allizom.org)",
    )
    parser.add_argument(
        "--endpoints", nargs="+", help="Specific endpoints to compare (default: all predefined)"
    )
    parser.add_argument("--output", "-o", help="Output file for detailed report (JSON format)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show detailed differences")

    args = parser.parse_args()

    comparator = TreeherderAPIComparator(args.local, args.staging)
    results = comparator.run_comparison(args.endpoints)

    if args.verbose:
        for result in results:
            if not result.data_matches:
                print(f"\nDifferences for {result.endpoint}:")
                for diff in result.differences:
                    print(diff)

    report = comparator.generate_report(results, args.output)

    # Exit with error code if there are mismatches
    if (
        report["comparison_summary"]["matching_endpoints"]
        < report["comparison_summary"]["total_endpoints"]
    ):
        sys.exit(1)


if __name__ == "__main__":
    main()
