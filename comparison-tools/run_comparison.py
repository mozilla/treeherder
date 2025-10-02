#!/usr/bin/env python3
"""
Treeherder Master Comparison Tool
Orchestrates all comparison tools and generates comprehensive reports
"""

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path


class TreeherderMasterComparator:
    def __init__(
        self,
        local_base_url="http://localhost:8000",
        staging_base_url="https://treeherder.allizom.org",
        output_dir="./comparison-results",
    ):
        self.local_base_url = local_base_url
        self.staging_base_url = staging_base_url
        self.output_dir = Path(output_dir)
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.results_dir = self.output_dir / f"comparison_{self.timestamp}"

        # Ensure output directory exists
        self.results_dir.mkdir(parents=True, exist_ok=True)

        self.tools_dir = Path(__file__).parent

    def run_api_comparison(self):
        """Run API comparison tool"""
        print("=" * 60)
        print("RUNNING API COMPARISON")
        print("=" * 60)

        try:
            cmd = [
                sys.executable,
                str(self.tools_dir / "api_comparator.py"),
                "--local",
                self.local_base_url,
                "--staging",
                self.staging_base_url,
                "--output",
                str(self.results_dir / "api_comparison.json"),
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

            return {
                "tool": "api_comparison",
                "success": result.returncode == 0,
                "output": result.stdout,
                "error": result.stderr,
                "report_file": str(self.results_dir / "api_comparison.json"),
            }

        except Exception as e:
            return {"tool": "api_comparison", "success": False, "error": str(e)}

    def run_ui_comparison(self):
        """Run UI comparison tool"""
        print("=" * 60)
        print("RUNNING UI COMPARISON")
        print("=" * 60)

        try:
            # Check if Node.js and required packages are available
            node_check = subprocess.run(["node", "--version"], capture_output=True)
            if node_check.returncode != 0:
                return {"tool": "ui_comparison", "success": False, "error": "Node.js not available"}

            # Install puppeteer if needed
            try:
                subprocess.run(
                    ["npm", "list", "puppeteer"],
                    capture_output=True,
                    check=True,
                    cwd=self.tools_dir,
                )
            except subprocess.CalledProcessError:
                print("Installing Puppeteer...")
                subprocess.run(["npm", "install", "puppeteer"], cwd=self.tools_dir, check=True)

            cmd = [
                "node",
                str(self.tools_dir / "ui_comparator.js"),
                "--local",
                self.local_base_url.replace("8000", "5001"),  # Frontend port
                "--staging",
                self.staging_base_url,
                "--output",
                str(self.results_dir / "ui_comparison"),
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)

            return {
                "tool": "ui_comparison",
                "success": result.returncode == 0,
                "output": result.stdout,
                "error": result.stderr,
                "report_file": str(
                    self.results_dir / "ui_comparison" / "ui-comparison-report.json"
                ),
            }

        except Exception as e:
            return {"tool": "ui_comparison", "success": False, "error": str(e)}

    def run_db_comparison(self):
        """Run database comparison tool"""
        print("=" * 60)
        print("RUNNING DATABASE COMPARISON")
        print("=" * 60)

        try:
            # Get local database URL from environment or default
            local_db_url = os.environ.get(
                "DATABASE_URL", "postgresql://postgres:mozilla1234@localhost:5499/treeherder"
            )

            cmd = [
                sys.executable,
                str(self.tools_dir / "db_comparator.py"),
                "--local-db",
                local_db_url,
                "--output",
                str(self.results_dir / "db_comparison.json"),
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

            return {
                "tool": "db_comparison",
                "success": result.returncode == 0,
                "output": result.stdout,
                "error": result.stderr,
                "report_file": str(self.results_dir / "db_comparison.json"),
            }

        except Exception as e:
            return {"tool": "db_comparison", "success": False, "error": str(e)}

    def run_config_comparison(self):
        """Run configuration comparison tool"""
        print("=" * 60)
        print("RUNNING CONFIGURATION COMPARISON")
        print("=" * 60)

        try:
            cmd = [
                sys.executable,
                str(self.tools_dir / "config_comparator.py"),
                "--local",
                self.local_base_url,
                "--staging",
                self.staging_base_url,
                "--output",
                str(self.results_dir / "config_comparison.json"),
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

            return {
                "tool": "config_comparison",
                "success": result.returncode == 0,
                "output": result.stdout,
                "error": result.stderr,
                "report_file": str(self.results_dir / "config_comparison.json"),
            }

        except Exception as e:
            return {"tool": "config_comparison", "success": False, "error": str(e)}

    def check_prerequisites(self):
        """Check if all prerequisites are met"""
        print("Checking prerequisites...")

        issues = []

        # Check if local services are running
        try:
            import requests

            response = requests.get(f"{self.local_base_url}/api/", timeout=5)
            if response.status_code != 200:
                issues.append(f"Local API not responding (status: {response.status_code})")
        except Exception as e:
            issues.append(f"Cannot reach local API: {e}")

        # Check if staging is accessible
        try:
            import requests

            response = requests.get(f"{self.staging_base_url}/api/", timeout=10)
            if response.status_code != 200:
                issues.append(f"Staging API not responding (status: {response.status_code})")
        except Exception as e:
            issues.append(f"Cannot reach staging API: {e}")

        # Check Python dependencies
        required_packages = ["requests", "psycopg2"]
        for package in required_packages:
            try:
                __import__(package)
            except ImportError:
                issues.append(f"Missing Python package: {package}")

        return issues

    def generate_master_report(self, results):
        """Generate comprehensive master report"""

        # Count successes and failures
        successful_tools = sum(1 for r in results if r.get("success", False))
        total_tools = len(results)

        master_report = {
            "comparison_summary": {
                "timestamp": datetime.now().isoformat(),
                "local_base_url": self.local_base_url,
                "staging_base_url": self.staging_base_url,
                "total_tools": total_tools,
                "successful_tools": successful_tools,
                "failed_tools": total_tools - successful_tools,
                "success_rate": (successful_tools / total_tools * 100) if total_tools > 0 else 0,
            },
            "tool_results": results,
            "recommendations": self.generate_recommendations(results),
        }

        # Save master report
        master_report_file = self.results_dir / "master_report.json"
        with open(master_report_file, "w") as f:
            json.dump(master_report, f, indent=2)

        # Generate HTML report
        html_report = self.generate_html_report(master_report)
        html_report_file = self.results_dir / "master_report.html"
        with open(html_report_file, "w") as f:
            f.write(html_report)

        return master_report, str(master_report_file), str(html_report_file)

    def generate_recommendations(self, results):
        """Generate recommendations based on comparison results"""
        recommendations = []

        for result in results:
            if not result.get("success", False):
                tool_name = result.get("tool", "unknown")
                error = result.get("error", "Unknown error")

                if "api_comparison" in tool_name:
                    recommendations.append(
                        {
                            "category": "API Issues",
                            "severity": "high",
                            "message": f"API comparison failed: {error}",
                            "action": "Check if local services are running and accessible",
                        }
                    )

                elif "ui_comparison" in tool_name:
                    recommendations.append(
                        {
                            "category": "UI Issues",
                            "severity": "medium",
                            "message": f"UI comparison failed: {error}",
                            "action": "Install Node.js and Puppeteer, check frontend service",
                        }
                    )

                elif "db_comparison" in tool_name:
                    recommendations.append(
                        {
                            "category": "Database Issues",
                            "severity": "high",
                            "message": f"Database comparison failed: {error}",
                            "action": "Check database connectivity and credentials",
                        }
                    )

                elif "config_comparison" in tool_name:
                    recommendations.append(
                        {
                            "category": "Configuration Issues",
                            "severity": "medium",
                            "message": f"Configuration comparison failed: {error}",
                            "action": "Review environment variables and service configuration",
                        }
                    )

        # Add general recommendations
        if all(r.get("success", False) for r in results):
            recommendations.append(
                {
                    "category": "Success",
                    "severity": "info",
                    "message": "All comparison tools completed successfully",
                    "action": "Review individual reports for detailed findings",
                }
            )

        return recommendations

    def generate_html_report(self, master_report):
        """Generate HTML master report"""
        return f"""
<!DOCTYPE html>
<html>
<head>
    <title>Treeherder Master Comparison Report</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .header {{ background: #2c3e50; color: white; padding: 20px; border-radius: 5px; }}
        .summary {{ background: #ecf0f1; padding: 15px; border-radius: 5px; margin: 20px 0; }}
        .tool-result {{ border: 1px solid #bdc3c7; margin: 10px 0; padding: 15px; border-radius: 5px; }}
        .success {{ border-left: 5px solid #27ae60; }}
        .failure {{ border-left: 5px solid #e74c3c; }}
        .recommendations {{ background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; }}
        .recommendation {{ margin: 10px 0; padding: 10px; border-radius: 3px; }}
        .high {{ background: #ffebee; }}
        .medium {{ background: #fff3e0; }}
        .info {{ background: #e8f5e8; }}
        pre {{ background: #f8f9fa; padding: 10px; border-radius: 3px; overflow-x: auto; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Treeherder Master Comparison Report</h1>
        <p>Generated: {master_report["comparison_summary"]["timestamp"]}</p>
    </div>

    <div class="summary">
        <h2>Summary</h2>
        <p><strong>Local URL:</strong> {master_report["comparison_summary"]["local_base_url"]}</p>
        <p><strong>Staging URL:</strong> {master_report["comparison_summary"]["staging_base_url"]}</p>
        <p><strong>Tools Run:</strong> {master_report["comparison_summary"]["total_tools"]}</p>
        <p><strong>Successful:</strong> {master_report["comparison_summary"]["successful_tools"]}</p>
        <p><strong>Failed:</strong> {master_report["comparison_summary"]["failed_tools"]}</p>
        <p><strong>Success Rate:</strong> {master_report["comparison_summary"]["success_rate"]:.1f}%</p>
    </div>

    <div class="recommendations">
        <h2>Recommendations</h2>
        {self.format_recommendations_html(master_report["recommendations"])}
    </div>

    <h2>Tool Results</h2>
    {self.format_tool_results_html(master_report["tool_results"])}

</body>
</html>"""

    def format_recommendations_html(self, recommendations):
        html = ""
        for rec in recommendations:
            severity_class = rec.get("severity", "info")
            html += f"""
            <div class="recommendation {severity_class}">
                <strong>{rec["category"]} ({rec["severity"].upper()}):</strong> {rec["message"]}<br>
                <em>Action:</em> {rec["action"]}
            </div>
            """
        return html

    def format_tool_results_html(self, results):
        html = ""
        for result in results:
            success_class = "success" if result.get("success", False) else "failure"
            status = "SUCCESS" if result.get("success", False) else "FAILED"

            html += f"""
            <div class="tool-result {success_class}">
                <h3>{result["tool"].replace("_", " ").title()} - {status}</h3>

                {f"<p><strong>Report File:</strong> {result['report_file']}</p>" if result.get("report_file") else ""}

                {f"<h4>Output:</h4><pre>{result['output']}</pre>" if result.get("output") else ""}

                {f"<h4>Error:</h4><pre>{result['error']}</pre>" if result.get("error") else ""}
            </div>
            """
        return html

    def run_all_comparisons(self, skip_tools=None):
        """Run all comparison tools"""
        skip_tools = skip_tools or []

        print(f"Starting Treeherder comparison at {datetime.now()}")
        print(f"Local: {self.local_base_url}")
        print(f"Staging: {self.staging_base_url}")
        print(f"Results will be saved to: {self.results_dir}")

        # Check prerequisites
        issues = self.check_prerequisites()
        if issues:
            print("\nPrerequisite issues found:")
            for issue in issues:
                print(f"  - {issue}")
            print("\nProceeding anyway, but some tools may fail...\n")

        results = []

        # Run each comparison tool
        if "api" not in skip_tools:
            results.append(self.run_api_comparison())

        if "ui" not in skip_tools:
            results.append(self.run_ui_comparison())

        if "db" not in skip_tools:
            results.append(self.run_db_comparison())

        if "config" not in skip_tools:
            results.append(self.run_config_comparison())

        # Generate master report
        master_report, json_file, html_file = self.generate_master_report(results)

        print("\n" + "=" * 60)
        print("MASTER COMPARISON COMPLETE")
        print("=" * 60)
        print(f"Success Rate: {master_report['comparison_summary']['success_rate']:.1f}%")
        print(f"Successful Tools: {master_report['comparison_summary']['successful_tools']}")
        print(f"Failed Tools: {master_report['comparison_summary']['failed_tools']}")
        print("\nReports saved:")
        print(f"  JSON: {json_file}")
        print(f"  HTML: {html_file}")

        # Show recommendations
        if master_report["recommendations"]:
            print("\nRecommendations:")
            for rec in master_report["recommendations"]:
                print(f"  [{rec['severity'].upper()}] {rec['category']}: {rec['message']}")

        return master_report


def main():
    parser = argparse.ArgumentParser(description="Run comprehensive Treeherder comparison")
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
        "--output",
        default="./comparison-results",
        help="Output directory (default: ./comparison-results)",
    )
    parser.add_argument(
        "--skip",
        nargs="+",
        choices=["api", "ui", "db", "config"],
        help="Skip specific comparison tools",
    )

    args = parser.parse_args()

    comparator = TreeherderMasterComparator(
        local_base_url=args.local, staging_base_url=args.staging, output_dir=args.output
    )

    try:
        master_report = comparator.run_all_comparisons(skip_tools=args.skip)

        # Exit with error code if any tools failed
        if master_report["comparison_summary"]["failed_tools"] > 0:
            sys.exit(1)

    except KeyboardInterrupt:
        print("\nComparison interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"Comparison failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
