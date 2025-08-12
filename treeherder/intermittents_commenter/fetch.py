import requests
import yaml

firefoxci_service_api_url = "https://firefox-ci-tc.services.mozilla.com/api/index/v1"
firefoxci_artefact_api_url = f"{firefoxci_service_api_url}/task/gecko.v2.mozilla-central.latest.source.test-info-all/artifacts/public"


def fetch_test_variants():
    mozilla_central_url = "https://hg.mozilla.org/mozilla-central"
    variant_file_url = f"{mozilla_central_url}/raw-file/tip/taskcluster/test_configs/variants.yml"
    response = requests.get(variant_file_url, headers={"User-agent": "mach-test-info/1.0"})
    return yaml.safe_load(response.text)


def fetch_test_manifests():
    test_info_url = f"{firefoxci_artefact_api_url}/test-info-all-tests.json"
    response = requests.get(test_info_url, headers={"User-agent": "mach-test-info/1.0"})
    return response.json()


def fetch_testrun_matrix():
    testrun_matrix_url = f"{firefoxci_artefact_api_url}/test-info-testrun-matrix.json"
    response = requests.get(testrun_matrix_url, headers={"User-agent": "mach-test-info/1.0"})
    return response.json()


def fetch_summary_groups(days):
    testrun_info_url = f"{firefoxci_artefact_api_url}/test-run-info.json"
    response = requests.get(testrun_info_url, headers={"User-agent": "mach-test-info/1.0"})
    summary_groups = response.json()
    return {key: summary_groups[key] for key in days if key in summary_groups}
