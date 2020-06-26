import os

import pytest
from jx_mysql.mysql import MySQL

from mo_logs import Log, constants, startup
from mo_logs.convert import unix2datetime
from mo_math.randoms import Random
from mo_times import Date
from treeherder.extract import extract_jobs, extract_alerts
from treeherder.model.models import (
    ClassifiedFailure,
    Commit,
    FailureClassification,
    FailureLine,
    Job,
    JobLog,
    Option,
    OptionCollection,
    Push,
    Repository,
    RepositoryGroup,
    TaskclusterMetadata,
    TextLogError,
    TextLogStep,
)


@pytest.fixture
def failure_class(transactional_db):
    fc = FailureClassification.objects.create(id=1, name="not classified")
    fc.save()


@pytest.fixture
def now():
    return Date.now().datetime


@pytest.fixture
def complex_job(
    transactional_db, generic_reference_data, test_repository, extract_job_settings, now
):
    fc = FailureClassification.objects.create(id=1, name="not classified")
    repository_group = RepositoryGroup.objects.create(name="common")
    repo = Repository.objects.create(name="autoland", repository_group=repository_group)

    push = Push.objects.create(
        **{
            "author": "testing@mozilla.com",
            "repository": repo,
            "revision": "ae6bb3a1066959a8c43d003a3caab0af769455bf",
            "time": unix2datetime(1578427105).replace(tzinfo=None),
        }
    )

    Commit.objects.create(
        push=push,
        revision="ae6bb3a1066959a8c43d003a3caab0af769455bf",
        author="testing@mozilla.com",
        comments="no comment",
    )
    Commit.objects.create(
        push=push,
        revision="0123456789012345678901234567890123456789",
        author="testing2@mozilla.com",
        comments="no comment2",
    )

    debug = Option.objects.create(name="debug")
    oc = OptionCollection.objects.create(option_collection_hash=Random.base64(5), option=debug)

    job = Job.objects.create(
        autoclassify_status=1,
        guid=Random.base64(20),
        repository=test_repository,
        push_id=push.id,
        signature=generic_reference_data.signature,
        build_platform=generic_reference_data.build_platform,
        machine_platform=generic_reference_data.machine_platform,
        machine=generic_reference_data.machine,
        option_collection_hash=oc.option_collection_hash,
        job_type=generic_reference_data.job_type,
        job_group=generic_reference_data.job_group,
        product=generic_reference_data.product,
        failure_classification_id=fc.id,
        who="example@mozilla.com",
        reason="scheduled",
        result="success",
        state="completed",
        submit_time=unix2datetime(1578427253).replace(tzinfo=None),
        start_time=unix2datetime(1578430841).replace(tzinfo=None),
        last_modified=unix2datetime(1578432686.364459).replace(tzinfo=None),
        end_time=unix2datetime(1578432680).replace(tzinfo=None),
        tier=1,
    )

    text_log_step = TextLogStep.objects.create(
        job=job,
        **{
            "finished_line_number": 88739,
            "name": "Unnamed step",
            "result": 7,
            "started_line_number": 0,
        },
    )

    TextLogError.objects.create(
        step=text_log_step, line="line contents here", line_number=619845839
    )
    TextLogError.objects.create(step=text_log_step, line="ERROR! more line contents", line_number=6)

    TaskclusterMetadata.objects.create(job=job, retry_id=0, task_id="WWb9ExAvQUa78ku0DIxdSQ")

    JobLog.objects.create(
        **{
            "job_id": job.id,
            "name": "live_backing_log",
            "status": 1,
            "url": "https://example.com/api/queue/v1/task/WWb9ExAvQUa78ku0DIxdSQ/runs/0/artifacts/public/logs/live_backing.log",
        }
    )
    job_logs1 = JobLog.objects.create(
        **{
            "job_id": job.id,
            "name": "errorsummary_json",
            "status": 1,
            "url": "https://example.com/api/queue/v1/task/WWb9ExAvQUa78ku0DIxdSQ/runs/0/artifacts/public/test_info/wpt_errorsummary.log",
        }
    )

    bcf = ClassifiedFailure.objects.create(**{"bug_number": 1234567,})
    bcf.created = Date("2020-01-17 12:00:00").datetime
    bcf.save()

    FailureLine.objects.create(
        job_log=job_logs1,
        **{
            "action": "test_groups",
            "best_classification": bcf,
            "best_is_verified": True,
            "repository": repo,
            "job_guid": job.guid,
            "line": 15,
            "modified": 0,
            "stackwalk_stderr": 1578432686,
            "stackwalk_stdout": 1578432686,
        },
    )
    FailureLine.objects.create(
        job_log=job_logs1,
        **{
            "action": "crash",
            "best_classification": bcf,
            "best_is_verified": False,
            "repository": repo,
            "job_guid": job.guid,
            "line": 24031,
            "modified": 0,
            "signature": "@ mozilla::dom::CustomElementData::SetCustomElementDefinition(mozilla::dom::CustomElementDefinition*)",
            "stackwalk_stderr": 1578432686,
            "stackwalk_stdout": 1578432686,
            "test": "/custom-elements/upgrading.html",
        },
    )

    return job


@pytest.fixture
def env_setup():
    # These values not directly accessed during testing, but the code requires that they be present.
    os.environ["NEW_RELIC_APP_NAME"] = "testing"
    os.environ["BIGQUERY_PRIVATE_KEY_ID"] = "1"
    os.environ["BIGQUERY_PRIVATE_KEY"] = "1"

    # THE DOCKER ENV IS DIFFERENT FROM THE DEV ENVIRONMENT
    attempt = [
        "mysql://root@127.0.0.1:3306/test_treeherder",
        "mysql://root@mysql:3306/test_treeherder",
    ]
    for a in attempt:
        try:
            MySQL(host=a)
            os.environ["DATABASE_URL"] = a
        except Exception:
            pass


@pytest.fixture
def extract_job_settings(env_setup):
    settings = startup.read_settings(filename=extract_jobs.CONFIG_FILE, complain=False)
    settings.source.database.ssl = None  # NOT REQUIRED FOR TEST DATABASE
    constants.set(settings.constants)
    Log.start(settings.debug)
    return settings


@pytest.fixture
def extract_alert_settings(env_setup):
    settings = startup.read_settings(filename=extract_alerts.CONFIG_FILE, complain=False)
    settings.source.database.ssl = None  # NOT REQUIRED FOR TEST DATABASE
    constants.set(settings.constants)
    Log.start(settings.debug)
    return settings
