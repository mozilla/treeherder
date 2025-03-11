import copy
import datetime
import json

import pytest
import responses
from requests.models import HTTPError

from treeherder.etl.artifact import store_job_artifacts
from treeherder.etl.classification_loader import ClassificationLoader
from treeherder.model.models import (
    BugJobMap,
    Bugscache,
    FailureClassification,
    Job,
    JobNote,
    MozciClassification,
    Push,
    Repository,
    RepositoryGroup,
)

DEFAULT_GTD_CONFIG = {
    "json": {
        "routes": ["index.project.mozci.classification.autoland.revision.A35mWTRuQmyj88yMnIF0fA"]
    },
    "content_type": "application/json",
    "status": 200,
}
DEFAULT_DA_CONFIG = {
    "json": {
        "push": {
            "id": "autoland/c73bcc465e0c2bce7debb0a86277e2dcb27444e4",
            "classification": "GOOD",
        },
        "failures": {
            "real": {},
            "intermittent": {
                "testing/web-platform/tests/webdriver/tests/element_click": [],
                "devtools/client/framework/test/browser.ini": [
                    {
                        "task_id": "V3SVuxO8TFy37En_6HcXLs",
                        "label": "test-linux1804-64-qr/opt-mochitest-devtools-chrome-dt-no-eft-nofis-e10s-1",
                        # autoclassify is True, there is a cached bug test1.js => autoclassification with one associated bug
                        "autoclassify": True,
                        "tests": ["devtools/client/framework/test/test1.js"],
                    },
                    {
                        "task_id": "FJtjczXfTAGClIl6wNBo9g",
                        "label": "test-linux1804-64-qr/opt-mochitest-devtools-chrome-dt-no-eft-nofis-e10s-2",
                        # autoclassify is True, there are two cached bugs test1.js and test2.js => autoclassification with two associated bugs
                        "autoclassify": True,
                        "tests": [
                            "devtools/client/framework/test/test1.js",
                            "devtools/client/framework/test/test2.js",
                        ],
                    },
                ],
                "devtools/client/framework/test2/browser.ini": [
                    {
                        "task_id": "RutlNkofzrbTnbauRSTJWc",
                        "label": "test-linux1804-64-qr/opt-mochitest-devtools-chrome-dt-no-eft-nofis-e10s-3",
                        # autoclassify is False, there is a cached bug for test1.js => no autoclassification
                        "autoclassify": False,
                        "tests": ["devtools/client/framework/test/test1.js"],
                    },
                    {
                        "task_id": "HTZJyyQLalgtOkbwDBxChF",
                        "label": "test-linux1804-64-qr/opt-mochitest-devtools-chrome-dt-no-eft-nofis-e10s-4",
                        # Even if autoclassify is True, there is no cached bug for test3.js => no autoclassification
                        "autoclassify": True,
                        "tests": ["devtools/client/framework/test/test3.js"],
                    },
                ],
            },
            "unknown": {},
        },
    },
    "content_type": "application/json",
    "status": 200,
}


@pytest.fixture
def autoland_repository():
    group = RepositoryGroup.objects.create(name="development")

    return Repository.objects.create(
        dvcs_type="hg",
        name="autoland",
        url="https://hg.mozilla.org/integration/autoland",
        active_status="active",
        codebase="gecko",
        repository_group=group,
        performance_alerts_enabled=True,
        expire_performance_data=False,
        tc_root_url="https://firefox-ci-tc.services.mozilla.com",
    )


@pytest.fixture
def autoland_push(autoland_repository):
    return Push.objects.create(
        repository=autoland_repository,
        revision="A35mWTRuQmyj88yMnIF0fA",
        author="foo@bar.com",
        time=datetime.datetime.now(),
    )


@pytest.fixture
def populate_bugscache():
    return Bugscache.objects.bulk_create(
        [
            Bugscache(
                id=1,
                bugzilla_id=1234567,
                status="NEW",
                summary="intermittent devtools/client/framework/test/test1.js | single tracking bug",
                modified="2014-01-01 00:00:00",
            ),
            Bugscache(
                id=2,
                bugzilla_id=2345678,
                status="NEW",
                summary="intermittent devtools/client/framework/test/test2.js | single tracking bug",
                modified="2014-01-01 00:00:00",
            ),
        ]
    )


@pytest.mark.parametrize(
    "mode, route",
    [
        ("production", "completely bad route"),
        ("production", "index.project.mozci.classification..revision.A35mWTRuQmyj88yMnIF0fA"),
        ("production", "index.project.mozci.classification.autoland.revision."),
        (
            "production",
            "index.project.mozci.classification.autoland.revision.-35mW@RuQ__j88yénIF0f-",
        ),
        (
            "production",
            "index.project.mozci.testing.classification.autoland.revision.A35mWTRuQmyj88yMnIF0fA",
        ),
        ("testing", "index.project.mozci.classification.autoland.revision.A35mWTRuQmyj88yMnIF0fA"),
    ],
)
def test_get_push_wrong_route(mode, route, monkeypatch):
    monkeypatch.setenv("PULSE_MOZCI_ENVIRONMENT", mode)

    with pytest.raises(AttributeError):
        ClassificationLoader().get_push(route)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "mode, route",
    [
        (
            "production",
            "index.project.mozci.classification.autoland.revision.A35mWTRuQmyj88yMnIF0fA",
        ),
        (
            "testing",
            "index.project.mozci.testing.classification.autoland.revision.A35mWTRuQmyj88yMnIF0fA",
        ),
    ],
)
def test_get_push_unsupported_project(mode, route, monkeypatch):
    monkeypatch.setenv("PULSE_MOZCI_ENVIRONMENT", mode)

    with pytest.raises(Repository.DoesNotExist) as e:
        ClassificationLoader().get_push(route)

    assert str(e.value) == "Repository matching query does not exist."


@pytest.mark.django_db
@pytest.mark.parametrize(
    "mode, route",
    [
        (
            "production",
            "index.project.mozci.classification.autoland.revision.A35mWTRuQmyj88yMnIF0fA",
        ),
        (
            "testing",
            "index.project.mozci.testing.classification.autoland.revision.A35mWTRuQmyj88yMnIF0fA",
        ),
    ],
)
def test_get_push_unsupported_revision(mode, route, autoland_repository, monkeypatch):
    monkeypatch.setenv("PULSE_MOZCI_ENVIRONMENT", mode)

    with pytest.raises(Push.DoesNotExist) as e:
        ClassificationLoader().get_push(route)

    assert str(e.value) == "Push matching query does not exist."


@pytest.mark.django_db
@pytest.mark.parametrize(
    "mode, route",
    [
        (
            "production",
            "index.project.mozci.classification.autoland.revision.A35mWTRuQmyj88yMnIF0fA",
        ),
        (
            "testing",
            "index.project.mozci.testing.classification.autoland.revision.A35mWTRuQmyj88yMnIF0fA",
        ),
    ],
)
def test_get_push(mode, route, autoland_push, monkeypatch):
    monkeypatch.setenv("PULSE_MOZCI_ENVIRONMENT", mode)

    assert ClassificationLoader().get_push(route) == autoland_push


def update_dict(dict, update):
    dict.update(update)
    return dict


@responses.activate
@pytest.mark.django_db
@pytest.mark.parametrize(
    "error_type, error_message, get_task_definition_config, get_push_error, download_artifact_config",
    [
        [HTTPError, "", {"status": 500}, None, DEFAULT_DA_CONFIG],
        [
            AssertionError,
            "A route containing the push project and revision is needed to save the mozci classification",
            update_dict({**DEFAULT_GTD_CONFIG}, {"json": {}}),
            None,
            DEFAULT_DA_CONFIG,
        ],
        [
            AssertionError,
            "A route containing the push project and revision is needed to save the mozci classification",
            update_dict({**DEFAULT_GTD_CONFIG}, {"json": {"routes": []}}),
            None,
            DEFAULT_DA_CONFIG,
        ],
        [
            AttributeError,
            None,
            update_dict({**DEFAULT_GTD_CONFIG}, {"json": {"routes": ["bad route"]}}),
            None,
            DEFAULT_DA_CONFIG,
        ],
        [None, None, DEFAULT_GTD_CONFIG, Repository.DoesNotExist, DEFAULT_DA_CONFIG],
        [
            Push.DoesNotExist,
            "Push matching query does not exist.",
            DEFAULT_GTD_CONFIG,
            Push.DoesNotExist,
            DEFAULT_DA_CONFIG,
        ],
        [HTTPError, "", DEFAULT_GTD_CONFIG, None, {"status": 500}],
        [
            AssertionError,
            "Classification result should be a value in BAD, GOOD, UNKNOWN",
            DEFAULT_GTD_CONFIG,
            None,
            update_dict(
                {**DEFAULT_DA_CONFIG},
                {
                    "json": {
                        "push": {
                            "id": "autoland/c73bcc465e0c2bce7debb0a86277e2dcb27444e4",
                            "classification": "WRONG",
                        }
                    }
                },
            ),
        ],
    ],
)
def test_process_handle_errors(
    monkeypatch,
    autoland_push,
    error_type,
    error_message,
    get_task_definition_config,
    get_push_error,
    download_artifact_config,
):
    root_url = "https://community-tc.services.mozilla.com"
    task_id = "A35mWTRuQmyj88yMnIF0fA"

    responses.add(
        responses.GET,
        f"{root_url}/api/queue/v1/task/{task_id}",
        **get_task_definition_config,
    )
    responses.add(
        responses.GET,
        f"{root_url}/api/queue/v1/task/{task_id}/artifacts/public/classification.json",
        **download_artifact_config,
    )

    if get_push_error:

        def mock_get_push(x, y):
            raise get_push_error(error_message)

        monkeypatch.setattr(ClassificationLoader, "get_push", mock_get_push)

    assert MozciClassification.objects.count() == 0

    if error_type:
        with pytest.raises(error_type) as e:
            ClassificationLoader().process({"status": {"taskId": task_id}}, root_url)
        if error_message:
            assert str(e.value) == error_message
    else:
        ClassificationLoader().process({"status": {"taskId": task_id}}, root_url)

    assert MozciClassification.objects.count() == 0


@responses.activate
@pytest.mark.django_db
def test_process_missing_failureclassification(autoland_push, test_two_jobs_tc_metadata):
    root_url = "https://community-tc.services.mozilla.com"
    task_id = "A35mWTRuQmyj88yMnIF0fA"

    responses.add(responses.GET, f"{root_url}/api/queue/v1/task/{task_id}", **DEFAULT_GTD_CONFIG)
    responses.add(
        responses.GET,
        f"{root_url}/api/queue/v1/task/{task_id}/artifacts/public/classification.json",
        **DEFAULT_DA_CONFIG,
    )

    assert MozciClassification.objects.count() == 0
    first_job, second_job = test_two_jobs_tc_metadata
    assert first_job.failure_classification.name == "not classified"
    assert second_job.failure_classification.name == "not classified"
    assert JobNote.objects.count() == 0
    assert BugJobMap.objects.count() == 0

    FailureClassification.objects.filter(name="autoclassified intermittent").delete()
    with pytest.raises(FailureClassification.DoesNotExist) as e:
        ClassificationLoader().process({"status": {"taskId": task_id}}, root_url)

    assert str(e.value) == "FailureClassification matching query does not exist."

    assert MozciClassification.objects.count() == 1
    classification = MozciClassification.objects.first()
    assert classification.push == autoland_push
    assert classification.result == MozciClassification.GOOD
    assert classification.task_id == task_id

    # Did not autoclassify since the requested FailureClassification was not found
    first_job.refresh_from_db()
    second_job.refresh_from_db()
    assert first_job.failure_classification.name == "not classified"
    assert second_job.failure_classification.name == "not classified"
    assert JobNote.objects.count() == 0
    assert BugJobMap.objects.count() == 0


@responses.activate
@pytest.mark.django_db
def test_process(autoland_push, test_two_jobs_tc_metadata, populate_bugscache):
    root_url = "https://community-tc.services.mozilla.com"
    task_id = "A35mWTRuQmyj88yMnIF0fA"

    responses.add(responses.GET, f"{root_url}/api/queue/v1/task/{task_id}", **DEFAULT_GTD_CONFIG)
    responses.add(
        responses.GET,
        f"{root_url}/api/queue/v1/task/{task_id}/artifacts/public/classification.json",
        **DEFAULT_DA_CONFIG,
    )

    assert MozciClassification.objects.count() == 0

    ClassificationLoader().process({"status": {"taskId": task_id}}, root_url)

    assert MozciClassification.objects.count() == 1
    classification = MozciClassification.objects.first()
    assert classification.push == autoland_push
    assert classification.result == MozciClassification.GOOD
    assert classification.task_id == task_id

    autoclassified_intermittent = FailureClassification.objects.get(
        name="autoclassified intermittent"
    )
    first_bug, second_bug = populate_bugscache

    first_job, second_job = test_two_jobs_tc_metadata
    first_job.refresh_from_db()
    assert first_job.failure_classification == autoclassified_intermittent
    assert JobNote.objects.filter(
        job=first_job, failure_classification=autoclassified_intermittent
    ).exists()
    maps = BugJobMap.objects.filter(job=first_job)
    assert maps.count() == 1
    assert maps.first().bug_id == first_bug.id

    second_job.refresh_from_db()
    assert second_job.failure_classification == autoclassified_intermittent
    assert JobNote.objects.filter(
        job=second_job, failure_classification=autoclassified_intermittent
    ).exists()
    maps = BugJobMap.objects.filter(job=second_job)
    assert maps.count() == 2
    assert list(maps.values_list("bug_id", flat=True)) == [first_bug.id, second_bug.id]


@pytest.mark.django_db
def test_autoclassify_failures_missing_job(failure_classifications, populate_bugscache):
    assert JobNote.objects.count() == 0
    assert BugJobMap.objects.count() == 0

    intermittents = {
        "group1": [
            {
                "task_id": "unknown_task_id",
                "label": "unknown_task",
                # Should be autoclassified if a matching Job exists
                "autoclassify": True,
                "tests": ["devtools/client/framework/test/test1.js"],
            }
        ]
    }
    with pytest.raises(Job.DoesNotExist) as e:
        ClassificationLoader().autoclassify_failures(
            intermittents, FailureClassification.objects.get(name="autoclassified intermittent")
        )

    assert str(e.value) == "Job matching query does not exist."

    assert JobNote.objects.count() == 0
    assert BugJobMap.objects.count() == 0


@pytest.mark.django_db
@pytest.mark.parametrize("existing_classification", [False, True])
def test_autoclassify_failures(
    existing_classification, test_two_jobs_tc_metadata, test_sheriff, populate_bugscache
):
    first_job, second_job = test_two_jobs_tc_metadata
    assert first_job.failure_classification.name == "not classified"
    assert second_job.failure_classification.name == "not classified"
    assert JobNote.objects.count() == 0
    assert BugJobMap.objects.count() == 0

    intermittent = FailureClassification.objects.get(name="intermittent")
    autoclassified_intermittent = FailureClassification.objects.get(
        name="autoclassified intermittent"
    )

    if existing_classification:
        JobNote.objects.create(
            job=first_job,
            failure_classification=intermittent,
            user=test_sheriff,
            text="Classified by a Sheriff",
        )
        assert JobNote.objects.count() == 1

    ClassificationLoader().autoclassify_failures(
        DEFAULT_DA_CONFIG["json"]["failures"]["intermittent"], autoclassified_intermittent
    )

    first_bug, second_bug = populate_bugscache

    # First job
    first_job.refresh_from_db()
    assert (
        first_job.failure_classification == intermittent
        if existing_classification
        else autoclassified_intermittent
    )

    assert JobNote.objects.filter(job=first_job).count() == 1
    job_note = JobNote.objects.filter(job=first_job).first()
    assert job_note.job == first_job
    assert (
        job_note.failure_classification == intermittent
        if existing_classification
        else autoclassified_intermittent
    )
    assert job_note.who == test_sheriff.email if existing_classification else "autoclassifier"
    assert (
        job_note.text == "Classified by a Sheriff"
        if existing_classification
        else "Autoclassified by mozci bot as an intermittent failure"
    )

    if not existing_classification:
        assert BugJobMap.objects.filter(job=first_job).count() == 1
        bug_job_map = BugJobMap.objects.filter(job=first_job).first()
        assert bug_job_map.job == first_job
        assert bug_job_map.bug_id == first_bug.id
        assert bug_job_map.who == "autoclassifier"

    # Second job
    second_job.refresh_from_db()
    assert second_job.failure_classification == autoclassified_intermittent

    assert JobNote.objects.filter(job=second_job).count() == 1
    job_note = JobNote.objects.filter(job=second_job).first()
    assert job_note.job == second_job
    assert job_note.failure_classification == autoclassified_intermittent
    assert job_note.who == "autoclassifier"
    assert job_note.text == "Autoclassified by mozci bot as an intermittent failure"

    maps = BugJobMap.objects.filter(job=second_job)
    assert maps.count() == 2
    assert list(maps.values_list("job", flat=True)) == [second_job.id, second_job.id]
    assert list(maps.values_list("bug_id", flat=True)) == [first_bug.id, second_bug.id]
    assert [m.who for m in maps] == ["autoclassifier", "autoclassifier"]

    assert JobNote.objects.count() == 2
    assert BugJobMap.objects.count() == 2 if existing_classification else 3


@responses.activate
@pytest.mark.django_db
def test_new_classification(autoland_push, sample_data, test_two_jobs_tc_metadata):
    assert MozciClassification.objects.count() == 0
    first_job, second_job = test_two_jobs_tc_metadata
    artifact1 = sample_data.text_log_summary
    artifact1["job_id"] = first_job.id
    artifact1["job_guid"] = first_job.guid
    artifact1["blob"] = json.dumps(artifact1["blob"])

    artifact2 = copy.deepcopy(artifact1)
    artifact2["job_id"] = second_job.id
    artifact1["job_guid"] = second_job.guid
    store_job_artifacts([artifact1, artifact2])

    # first is NEW
    second_job = Job.objects.get(id=1)
    first_job = Job.objects.get(id=2)
    assert first_job.failure_classification.name == "intermittent needs filing"

    # second instance is normal
    assert second_job.failure_classification.name == "not classified"

    # annotate each job and ensure marked as intermittent
