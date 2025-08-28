#!/usr/bin/env python3
"""
Performance test script for all group_results API endpoints in Treeherder.
Tests each endpoint multiple times and records timing information.
"""

import statistics
import time
from datetime import datetime

import requests

# Configuration
BASE_URL = "http://localhost:8000/api"
PROJECT = "autoland"
NUM_RUNS = 5  # Number of test runs per endpoint

# List of endpoints to test
ENDPOINTS = [
    {
        "name": "group_results (PRIMARY/OPTIMIZED)",
        "path": "group_results",
        "description": "Primary optimized endpoint with Redis caching (5-min TTL)",
    },
    {
        "name": "group_results_legacy",
        "path": "group_results_legacy",
        "description": "Legacy implementation - no optimizations",
    },
    {
        "name": "group_results2",
        "path": "group_results2",
        "description": "Using get_group_results_new with push.id",
    },
    {
        "name": "group_results3",
        "path": "group_results3",
        "description": "Using get_group_results_new_fast_dict",
    },
    {
        "name": "group_results4",
        "path": "group_results4",
        "description": "Using get_group_results_new_orm",
    },
    {
        "name": "group_results5",
        "path": "group_results5",
        "description": "Direct SQL without ORM overhead",
    },
    {"name": "group_results6", "path": "group_results6", "description": "Job-first approach"},
    {
        "name": "group_results7",
        "path": "group_results7",
        "description": "Job-first with JSON aggregation",
    },
    {
        "name": "group_results8",
        "path": "group_results8",
        "description": "Optimized V1: values_list with dict",
    },
    {
        "name": "group_results9",
        "path": "group_results9",
        "description": "Optimized V2: only() and iterator()",
    },
    {
        "name": "group_results10",
        "path": "group_results10",
        "description": "Optimized V3: Raw SQL from Group table",
    },
    {"name": "group_results11", "path": "group_results11", "description": "Optimized with caching"},
]


def get_latest_revision() -> str:
    """Get the latest push revision from the API."""
    try:
        response = requests.get(f"{BASE_URL}/project/{PROJECT}/push/?count=1")
        if response.status_code != 200:
            print(f"Error: API returned status {response.status_code}")
            print(f"Response: {response.text[:200]}")
            return None
        data = response.json()
        if data.get("results") and len(data["results"]) > 0:
            return data["results"][0]["revision"]
    except Exception as e:
        print(f"Error getting latest revision: {e}")
    return None


def test_endpoint(endpoint: dict, revision: str) -> tuple[list[float], bool, int]:
    """
    Test a single endpoint multiple times.
    Returns: (list of response times, success status, response size)
    """
    url = f"{BASE_URL}/project/{PROJECT}/push/{endpoint['path']}/?revision={revision}"
    times = []
    success = True
    response_size = 0

    for run in range(NUM_RUNS):
        try:
            start = time.time()
            response = requests.get(url)
            end = time.time()

            if response.status_code == 200:
                times.append(end - start)
                if run == 0:  # Record response size from first run
                    response_size = len(response.content)
            else:
                print(f"  Run {run + 1}: Failed with status {response.status_code}")
                success = False
        except Exception as e:
            print(f"  Run {run + 1}: Error - {e}")
            success = False

        # Small delay between runs
        if run < NUM_RUNS - 1:
            time.sleep(0.5)

    return times, success, response_size


def format_results_markdown(results: list[dict], revision: str) -> str:
    """Format test results as a markdown table."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    md = f"""# Treeherder group_results API Performance Test Results

**Test Date:** {timestamp}  
**Test Environment:** Local Docker  
**Base URL:** {BASE_URL}  
**Project:** {PROJECT}  
**Test Revision:** {revision}  
**Number of Runs per Endpoint:** {NUM_RUNS}  
**Database State:** Before index migration

## Summary

This test measures the performance of all group_results API endpoints in Treeherder.
Each endpoint was called {NUM_RUNS} times with the same revision to measure response times.

## Results

| Endpoint | Description | Avg Time (s) | Min Time (s) | Max Time (s) | Std Dev (s) | Response Size (KB) | Status |
|----------|-------------|-------------|--------------|--------------|-------------|-------------------|--------|
"""

    for result in results:
        if result["times"]:
            avg_time = statistics.mean(result["times"])
            min_time = min(result["times"])
            max_time = max(result["times"])
            std_dev = statistics.stdev(result["times"]) if len(result["times"]) > 1 else 0
            response_kb = result["response_size"] / 1024
            status = "✅ Success" if result["success"] else "❌ Failed"

            md += f"| {result['name']} | {result['description']} | {avg_time:.3f} | {min_time:.3f} | {max_time:.3f} | {std_dev:.3f} | {response_kb:.1f} | {status} |\n"
        else:
            md += f"| {result['name']} | {result['description']} | N/A | N/A | N/A | N/A | N/A | ❌ Failed |\n"

    # Add performance ranking
    md += "\n## Performance Ranking (by average time)\n\n"
    valid_results = [r for r in results if r["times"]]
    sorted_results = sorted(valid_results, key=lambda x: statistics.mean(x["times"]))

    md += "| Rank | Endpoint | Avg Time (s) | Improvement vs Legacy |\n"
    md += "|------|----------|--------------|----------------------|\n"

    # Find legacy baseline
    legacy_time = None
    for r in results:
        if "legacy" in r["name"].lower() and r["times"]:
            legacy_time = statistics.mean(r["times"])
            break

    for i, result in enumerate(sorted_results, 1):
        avg_time = statistics.mean(result["times"])
        if legacy_time and "legacy" not in result["name"].lower():
            improvement = ((legacy_time - avg_time) / legacy_time) * 100
            improvement_str = (
                f"{improvement:.1f}% faster"
                if improvement > 0
                else f"{abs(improvement):.1f}% slower"
            )
        elif "legacy" in result["name"].lower():
            improvement_str = "Baseline"
        else:
            improvement_str = "N/A"

        md += f"| {i} | {result['name']} | {avg_time:.3f} | {improvement_str} |\n"

    # Add raw timing data
    md += "\n## Raw Timing Data\n\n"
    md += "Detailed timing for each run (in seconds):\n\n"

    for result in results:
        if result["times"]:
            md += f"### {result['name']}\n"
            md += f"Runs: {', '.join([f'{t:.3f}' for t in result['times']])}\n\n"

    return md


def main():
    print("=" * 80)
    print("Treeherder group_results API Performance Test")
    print("=" * 80)

    # Get a revision to test with
    print("\nGetting latest revision...")
    revision = get_latest_revision()

    if not revision:
        # Fallback to a hardcoded revision if API fails
        revision = "95166f5b2a85db5652bc134b51d3d43a3455a26c"
        print(f"Using fallback revision: {revision}")

    print(f"Using revision: {revision}")
    print(f"Testing {len(ENDPOINTS)} endpoints with {NUM_RUNS} runs each")
    print("=" * 80)

    results = []

    for i, endpoint in enumerate(ENDPOINTS, 1):
        print(f"\n[{i}/{len(ENDPOINTS)}] Testing {endpoint['name']}...")
        print(f"  Description: {endpoint['description']}")

        times, success, response_size = test_endpoint(endpoint, revision)

        if times:
            avg_time = statistics.mean(times)
            print(f"  Average response time: {avg_time:.3f}s")
            print(f"  Response size: {response_size / 1024:.1f} KB")
        else:
            print("  No successful runs")

        results.append(
            {
                "name": endpoint["name"],
                "path": endpoint["path"],
                "description": endpoint["description"],
                "times": times,
                "success": success,
                "response_size": response_size,
            }
        )

    # Write results to markdown file
    output_file = "group_results_performance_test.md"
    print("\n" + "=" * 80)
    print(f"Writing results to {output_file}...")

    markdown_content = format_results_markdown(results, revision)

    with open(output_file, "w") as f:
        f.write(markdown_content)

    print(f"Results written to {output_file}")
    print("=" * 80)
    print("\nTest completed!")


if __name__ == "__main__":
    main()
