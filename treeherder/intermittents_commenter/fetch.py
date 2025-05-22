import requests
import yaml

firefoxci_service_api_url = "https://firefox-ci-tc.services.mozilla.com/api/index/v1"
firefoxci_artefact_api_url = f"{firefoxci_service_api_url}/task/gecko.v2.mozilla-central.latest.source.test-info-all/artifacts/public"


def fetch_test_variants():
    mozilla_central_url = "https://hg.mozilla.org/mozilla-central"
    variant_file_url = f"{mozilla_central_url}/raw-file/tip/taskcluster/kinds/test/variants.yml"
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


def get_summary_groups():
    url = "https://treeherder.mozilla.org/api/groupsummary/"
    response = requests.get(url, headers={"User-agent": "mach-test-info/1.0"})
    return response.json()
