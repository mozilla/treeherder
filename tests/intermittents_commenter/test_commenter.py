import responses
from django.conf import settings

from treeherder.intermittents_commenter.commenter import Commenter


@responses.activate
def test_intermittents_commenter(
    bug_data,
    mock_test_variants_firefoxci_request,
    mock_test_manifests_firefoxci_request,
    mock_testrun_matrix_firefoxci_request,
    mock_summary_groups_request,
):
    startday = "2022-05-09"
    endday = "2025-05-10"
    alt_startday = startday
    alt_endday = endday

    process = Commenter(weekly_mode=True, dry_run=True)
    params = {"include_fields": "product%2C+component%2C+priority%2C+whiteboard%2C+id"}
    url = "{}/rest/bug?id={}&include_fields={}".format(
        settings.BZ_API_URL, bug_data["bug_id"], params["include_fields"]
    )

    content = {
        "bugs": [
            {
                "component": "General",
                "priority": "P3",
                "product": "Testing",
                "whiteboard": "[stockwell infra] [see summary at comment 92]",
                "id": bug_data["bug_id"],
            }
        ],
        "faults": [],
    }

    responses.add(responses.Response(method="GET", url=url, json=content, status=200))

    resp = process.fetch_bug_details(bug_data["bug_id"])
    assert resp == content["bugs"]

    comment_params = process.generate_bug_changes(startday, endday, alt_startday, alt_endday)

    with open("tests/intermittents_commenter/expected_comment.text") as comment:
        expected_comment = comment.read()
    assert comment_params[0]["changes"]["comment"]["body"] == expected_comment


@responses.activate
def test_intermittents_commenter_with_failures(
    bug_data_with_5_failures,
    mock_test_variants_firefoxci_request,
    mock_test_manifests_firefoxci_request,
    mock_testrun_matrix_firefoxci_request,
    mock_summary_groups_request,
):
    startday = "2022-05-09"
    endday = "2025-05-10"
    alt_startday = startday
    alt_endday = endday

    process = Commenter(weekly_mode=True, dry_run=True)
    params = {"include_fields": "product%2C+component%2C+priority%2C+whiteboard%2C+id"}
    url = "{}/rest/bug?id={}&include_fields={}".format(
        settings.BZ_API_URL, bug_data_with_5_failures["bug_id"], params["include_fields"]
    )

    content = {
        "bugs": [
            {
                "component": "General",
                "priority": "P3",
                "product": "Testing",
                "whiteboard": "[stockwell infra] [see summary at comment 92]",
                "id": bug_data_with_5_failures["bug_id"],
            }
        ],
        "faults": [],
    }

    responses.add(responses.Response(method="GET", url=url, json=content, status=200))

    resp = process.fetch_bug_details(bug_data_with_5_failures["bug_id"])
    assert resp == content["bugs"]

    comment_params = process.generate_bug_changes(startday, endday, alt_startday, alt_endday)

    with open("tests/intermittents_commenter/expected_comment_with_5_failures.text") as comment:
        expected_comment = comment.read()
    assert comment_params[0]["changes"]["comment"]["body"] == expected_comment


def test_get_test_variants(mock_test_variants_firefoxci_request):
    process = Commenter(weekly_mode=True, dry_run=True)
    test_suite = "mochitest-browser-chrome-spi-nw-10"
    variants = process.get_test_variant(test_suite)
    assert variants == "spi-nw"
    test_suite = "mochitest-browser-chrome-2"
    variants = process.get_test_variant(test_suite)
    assert variants == "no_variant"
