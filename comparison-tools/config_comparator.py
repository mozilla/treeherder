#!/usr/bin/env python3
"""
Treeherder Configuration Comparison Tool
Compares configuration settings between local and staging environments
"""

import argparse
import json
import os
import subprocess
import sys
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any

import requests


@dataclass
class ConfigComparison:
    timestamp: str
    local_config: dict[str, Any]
    staging_config: dict[str, Any]
    differences: list[dict[str, Any]]
    environment_vars: dict[str, Any]
    django_settings: dict[str, Any]


class TreeherderConfigComparator:
    def __init__(
        self,
        local_base_url: str = "http://localhost:8000",
        staging_base_url: str = "https://treeherder.allizom.org",
    ):
        self.local_base_url = local_base_url
        self.staging_base_url = staging_base_url
        self.session = requests.Session()

        # Configuration endpoints and sources to check
        self.config_sources = {
            "api_info": "/api/",
            "version_info": "/__version__",
            "heartbeat": "/__heartbeat__",
            "lbheartbeat": "/__lbheartbeat__",
        }

        # Environment variables to check
        self.env_vars_to_check = [
            "TREEHERDER_DEBUG",
            "DATABASE_URL",
            "REDIS_URL",
            "BROKER_URL",
            "SITE_URL",
            "AUTH0_DOMAIN",
            "AUTH0_CLIENTID",
            "BUGZILLA_API_URL",
            "GITHUB_TOKEN",
            "NEW_RELIC_INSIGHTS_API_KEY",
            "PERFHERDER_ENABLE_MULTIDATA_INGESTION",
            "TELEMETRY_ENABLE_ALERTS",
            "PROJECTS_TO_INGEST",
        ]

    def get_endpoint_config(self, base_url: str, endpoint: str) -> dict[str, Any]:
        """Get configuration from an endpoint"""
        try:
            url = f"{base_url}{endpoint}"
            response = self.session.get(url, timeout=10)

            if response.status_code == 200:
                try:
                    return {
                        "status": "success",
                        "status_code": response.status_code,
                        "data": response.json(),
                        "headers": dict(response.headers),
                    }
                except json.JSONDecodeError:
                    return {
                        "status": "success",
                        "status_code": response.status_code,
                        "data": response.text[:500],
                        "headers": dict(response.headers),
                    }
            else:
                return {
                    "status": "error",
                    "status_code": response.status_code,
                    "error": response.text[:200],
                }

        except requests.exceptions.RequestException as e:
            return {"status": "error", "error": str(e)}

    def get_local_environment_config(self) -> dict[str, Any]:
        """Get local environment configuration"""
        config = {}

        # Get environment variables
        env_vars = {}
        for var in self.env_vars_to_check:
            value = os.environ.get(var)
            if value:
                # Mask sensitive values
                if any(
                    sensitive in var.lower() for sensitive in ["token", "key", "password", "secret"]
                ):
                    env_vars[var] = f"***{value[-4:]}" if len(value) > 4 else "***"
                else:
                    env_vars[var] = value
            else:
                env_vars[var] = None

        config["environment_variables"] = env_vars

        # Get Docker Compose configuration
        try:
            result = subprocess.run(
                ["docker-compose", "config"], capture_output=True, text=True, cwd="."
            )
            if result.returncode == 0:
                config["docker_compose"] = result.stdout
            else:
                config["docker_compose_error"] = result.stderr
        except Exception as e:
            config["docker_compose_error"] = str(e)

        # Get Git information
        try:
            # Get current branch
            result = subprocess.run(
                ["git", "branch", "--show-current"], capture_output=True, text=True
            )
            if result.returncode == 0:
                config["git_branch"] = result.stdout.strip()

            # Get latest commit
            result = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True)
            if result.returncode == 0:
                config["git_commit"] = result.stdout.strip()

            # Get commit date
            result = subprocess.run(
                ["git", "log", "-1", "--format=%ci"], capture_output=True, text=True
            )
            if result.returncode == 0:
                config["git_commit_date"] = result.stdout.strip()

        except Exception as e:
            config["git_error"] = str(e)

        # Get Python/Node versions
        try:
            result = subprocess.run(["python", "--version"], capture_output=True, text=True)
            if result.returncode == 0:
                config["python_version"] = result.stdout.strip()
        except:
            pass

        try:
            result = subprocess.run(["node", "--version"], capture_output=True, text=True)
            if result.returncode == 0:
                config["node_version"] = result.stdout.strip()
        except:
            pass

        return config

    def get_django_settings_info(self) -> dict[str, Any]:
        """Get Django settings information from local environment"""
        settings_info = {}

        try:
            # Try to get settings from Django management command
            result = subprocess.run(
                [
                    "docker-compose",
                    "exec",
                    "-T",
                    "backend",
                    "python",
                    "manage.py",
                    "shell",
                    "-c",
                    """
import json
from django.conf import settings

# Get key settings (non-sensitive)
config = {
    "DEBUG": getattr(settings, "DEBUG", None),
    "ALLOWED_HOSTS": getattr(settings, "ALLOWED_HOSTS", None),
    "DATABASES": {
        "default": {
            "ENGINE": settings.DATABASES["default"].get("ENGINE"),
            "NAME": settings.DATABASES["default"].get("NAME"),
            "HOST": settings.DATABASES["default"].get("HOST"),
            "PORT": settings.DATABASES["default"].get("PORT"),
        }
    } if hasattr(settings, "DATABASES") else None,
    "INSTALLED_APPS": getattr(settings, "INSTALLED_APPS", None),
    "MIDDLEWARE": getattr(settings, "MIDDLEWARE", None),
    "TIME_ZONE": getattr(settings, "TIME_ZONE", None),
    "USE_TZ": getattr(settings, "USE_TZ", None),
    "STATIC_URL": getattr(settings, "STATIC_URL", None),
    "CORS_ORIGIN_ALLOW_ALL": getattr(settings, "CORS_ORIGIN_ALLOW_ALL", None),
    "PERFHERDER_REGRESSION_THRESHOLD": getattr(settings, "PERFHERDER_REGRESSION_THRESHOLD", None),
    "CELERY_TASK_QUEUES": [q.name for q in getattr(settings, "CELERY_TASK_QUEUES", [])],
}

print(json.dumps(config, indent=2, default=str))
                """,
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode == 0:
                # Extract JSON from output (skip any Docker output)
                output_lines = result.stdout.strip().split("\n")
                json_start = -1
                for i, line in enumerate(output_lines):
                    if line.strip().startswith("{"):
                        json_start = i
                        break

                if json_start >= 0:
                    json_output = "\n".join(output_lines[json_start:])
                    settings_info = json.loads(json_output)
            else:
                settings_info["error"] = result.stderr

        except Exception as e:
            settings_info["error"] = str(e)

        return settings_info

    def compare_configurations(
        self, local_config: dict, staging_config: dict
    ) -> list[dict[str, Any]]:
        """Compare two configuration dictionaries"""
        differences = []

        def compare_recursive(local_data, staging_data, path=""):
            if isinstance(local_data, dict) and isinstance(staging_data, dict):
                # Compare keys
                local_keys = set(local_data.keys())
                staging_keys = set(staging_data.keys())

                # Missing keys
                for key in staging_keys - local_keys:
                    differences.append(
                        {
                            "type": "missing_in_local",
                            "path": f"{path}.{key}" if path else key,
                            "staging_value": staging_data[key],
                        }
                    )

                for key in local_keys - staging_keys:
                    differences.append(
                        {
                            "type": "missing_in_staging",
                            "path": f"{path}.{key}" if path else key,
                            "local_value": local_data[key],
                        }
                    )

                # Compare common keys
                for key in local_keys & staging_keys:
                    new_path = f"{path}.{key}" if path else key
                    compare_recursive(local_data[key], staging_data[key], new_path)

            elif isinstance(local_data, list) and isinstance(staging_data, list):
                if len(local_data) != len(staging_data):
                    differences.append(
                        {
                            "type": "list_length_difference",
                            "path": path,
                            "local_length": len(local_data),
                            "staging_length": len(staging_data),
                        }
                    )

                # Compare list items (simplified)
                for i, (local_item, staging_item) in enumerate(zip(local_data, staging_data)):
                    compare_recursive(local_item, staging_item, f"{path}[{i}]")

            else:
                if local_data != staging_data:
                    differences.append(
                        {
                            "type": "value_difference",
                            "path": path,
                            "local_value": local_data,
                            "staging_value": staging_data,
                        }
                    )

        compare_recursive(local_config, staging_config)
        return differences

    def run_comparison(self) -> ConfigComparison:
        """Run complete configuration comparison"""
        print("Starting configuration comparison...")

        # Get configurations from both environments
        local_config = {}
        staging_config = {}

        # Get endpoint configurations
        for name, endpoint in self.config_sources.items():
            print(f"Checking endpoint: {endpoint}")
            local_config[name] = self.get_endpoint_config(self.local_base_url, endpoint)
            staging_config[name] = self.get_endpoint_config(self.staging_base_url, endpoint)

        # Get local environment configuration
        print("Getting local environment configuration...")
        local_env_config = self.get_local_environment_config()
        local_config["environment"] = local_env_config

        # Get Django settings
        print("Getting Django settings...")
        django_settings = self.get_django_settings_info()

        # Compare configurations
        differences = self.compare_configurations(local_config, staging_config)

        return ConfigComparison(
            timestamp=datetime.now().isoformat(),
            local_config=local_config,
            staging_config=staging_config,
            differences=differences,
            environment_vars=local_env_config.get("environment_variables", {}),
            django_settings=django_settings,
        )

    def generate_report(self, comparison: ConfigComparison, output_file: str = None):
        """Generate configuration comparison report"""
        report = asdict(comparison)

        if output_file:
            with open(output_file, "w") as f:
                json.dump(report, f, indent=2, default=str)
            print(f"\nDetailed report saved to: {output_file}")

        # Print summary
        print("\n" + "=" * 60)
        print("CONFIGURATION COMPARISON SUMMARY")
        print("=" * 60)
        print(f"Total differences found: {len(comparison.differences)}")

        # Categorize differences
        diff_types = {}
        for diff in comparison.differences:
            diff_type = diff["type"]
            if diff_type not in diff_types:
                diff_types[diff_type] = []
            diff_types[diff_type].append(diff)

        for diff_type, diffs in diff_types.items():
            print(f"\n{diff_type.replace('_', ' ').title()}: {len(diffs)}")
            for diff in diffs[:5]:  # Show first 5 of each type
                path = diff.get("path", "unknown")
                if diff_type == "value_difference":
                    local_val = str(diff.get("local_value", "N/A"))[:50]
                    staging_val = str(diff.get("staging_value", "N/A"))[:50]
                    print(f"  {path}: {local_val} != {staging_val}")
                elif diff_type == "missing_in_local":
                    print(f"  {path}: missing in local")
                elif diff_type == "missing_in_staging":
                    print(f"  {path}: missing in staging")

            if len(diffs) > 5:
                print(f"  ... and {len(diffs) - 5} more")

        # Show environment variables status
        print("\nENVIRONMENT VARIABLES:")
        for var, value in comparison.environment_vars.items():
            status = "SET" if value else "NOT SET"
            print(f"  {var}: {status}")

        # Show Django settings status
        if comparison.django_settings:
            print("\nDJANGO SETTINGS:")
            if "error" in comparison.django_settings:
                print(f"  Error getting settings: {comparison.django_settings['error']}")
            else:
                print(f"  DEBUG: {comparison.django_settings.get('DEBUG')}")
                print(
                    f"  Database Engine: {comparison.django_settings.get('DATABASES', {}).get('default', {}).get('ENGINE')}"
                )
                print(
                    f"  Installed Apps: {len(comparison.django_settings.get('INSTALLED_APPS', []))}"
                )
                print(
                    f"  Celery Queues: {len(comparison.django_settings.get('CELERY_TASK_QUEUES', []))}"
                )

        return report


def main():
    parser = argparse.ArgumentParser(description="Compare Treeherder configurations")
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
    parser.add_argument("--output", "-o", help="Output file for detailed report (JSON format)")

    args = parser.parse_args()

    comparator = TreeherderConfigComparator(args.local, args.staging)

    try:
        comparison = comparator.run_comparison()
        report = comparator.generate_report(comparison, args.output)

        # Exit with error code if there are significant differences
        significant_diffs = [
            d
            for d in comparison.differences
            if d["type"] in ["missing_in_local", "missing_in_staging", "value_difference"]
            and not any(
                ignore in d.get("path", "") for ignore in ["timestamp", "commit", "version"]
            )
        ]

        if significant_diffs:
            print(f"\nFound {len(significant_diffs)} significant configuration differences")
            sys.exit(1)

    except Exception as e:
        print(f"Configuration comparison failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
