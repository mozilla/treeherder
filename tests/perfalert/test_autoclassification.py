import datetime
import pytest

from treeherder.model.derived.jobs import JobsModel
from tests.conftest import add_test_procs_file
from treeherder.perf.autoclassify import is_merge
from treeherder.perf.autoclassify import contains_word_merge
from treeherder.perf.autoclassify import resultset_is_merge
from treeherder.perf.autoclassify import summary_is_merge
from treeherder.perf.autoclassify import classify_possible_downstream2
from treeherder.perf.autoclassify import classify_possible_downstream
from treeherder.perf.autoclassify import get_result_set

@pytest.fixture
def jobs_ds_upstream(request, transactional_db):
    from treeherder.model.models import Datasource
    ds = Datasource.objects.create(project="fx-team")

    def fin():
        ds.delete()
    request.addfinalizer(fin)

    return ds

@pytest.fixture
def jobs_ds_downstream(request, transactional_db):
    from treeherder.model.models import Datasource
    ds = Datasource.objects.create(project="mozilla-inbound")

    def fin():
        ds.delete()
    request.addfinalizer(fin)

    return ds

@pytest.fixture
def jm_upstream(request, upstream_repository, jobs_ds_upstream):
    """ Give a test access to a JobsModel instance. """
    model = JobsModel(jobs_ds_upstream.project)

    def fin():
        model.disconnect()
    request.addfinalizer(fin)

    return model

@pytest.fixture
def jm_downstream(request, downstream_repository, jobs_ds_downstream):
    """ Give a test access to a JobsModel instance. """
    model = JobsModel(jobs_ds_downstream.project)

    def fin():
        model.disconnect()
    request.addfinalizer(fin)

    return model

@pytest.fixture
def downstream_resultset_sample():
    return {
            "revision": "49beae1792077eba5b790baa7d3c1a37ca3eb609",
            "comment": "Merge m-c to inbound. a=merge",
            "push_timestamp": 1464276157,
            "revisions": [
                {
                    "repository": "mozilla-inbound",
                    "author": "Brian Grinstead <bgrinstead@mozilla.com>",
                    "comment": "Bug 1271096 - Make sure source links can be tabbed into;r=fitzgen\n\nMozReview-Commit-ID: FPwYQyLQw4m",
                    "revision": "73817edbdfd6f66e75b13eeb9a883994d04f178d"
                },
                {
                    "repository": "mozilla-inbound",
                    "author": "Wes Kocher <wkocher@mozilla.com>",
                    "comment": "Merge m-c to fx-team, a=merge",
                    "revision": "9ef45b3ae61d40b772319a314205ddacfe00cff9"
                },
                {
                    "repository": "mozilla-inbound",
                    "author": "Felipe Gomes <felipc@gmail.com>",
                    "comment": "Bug 1275040 - Block e10s from being activated in OS X 10.6 - 10.8 in all channels. r=jimm\n\nMozReview-Commit-ID: HOXJgZ4b10x",
                    "revision": "94bc94b961768538296b30ef704f99fcfe9d5874"
                }
            ],
        }

@pytest.fixture
def upstream_resultset_sample():
    return {
            "revision": "8dfd7c9d86397ed898d84933a3c39834f1db886f",
            "comment": "Bug 1275706 - Tune eslint max line length to 90. r=jryans\n\nMozReview-Commit-ID: BcMKGVZoXND",
            "push_timestamp": 1464232548,
            "revisions": [
                {
                    "repository": "fx-team",
                    "author": "Brian Grinstead <bgrinstead@mozilla.com>",
                    "comment": "Bug 1275706 - Tune eslint max line length to 90. r=jryans\n\nMozReview-Commit-ID: BcMKGVZoXND",
                    "revision": "8dfd7c9d86397ed898d84933a3c39834f1db886f"
                },
            ],
        }
@pytest.fixture
def normal_resultset_sample():
    return {
            "revision": "fa77bc23f79923dae5b25e4e23584d8f2caedf74",
            "comment": "Bug 1275591 - Enable plugin content blocking by default. r=bsmedberg",
            "push_timestamp": 1464281236,
            "revisions": [
                {
                    "repository": "mozilla-inbound",
                    "author": "Tobias Schneider <schneider@jancona.com>",
                    "comment": "Bug 1275591 - Enable plugin content blocking by default. r=bsmedberg",
                    "revision": "fa77bc23f79923dae5b25e4e23584d8f2caedf74"
                }
            ],
        }

@pytest.fixture
def downstream_repository(transactional_db):
    from treeherder.model.models import Repository, RepositoryGroup

    repo_group = RepositoryGroup.objects.get_or_create(
        name="development",
        description=""
    )

    r = Repository.objects.create(
        dvcs_type="hg",
        name="mozilla-inbound",
        url="https://hg.mozilla.org/mozilla-inbound",
        active_status="active",
        codebase="gecko",
        repository_group=repo_group[0],
        description="",
        performance_alerts_enabled=True
    )
    return r

@pytest.fixture
def upstream_repository(transactional_db):
    from treeherder.model.models import Repository, RepositoryGroup

    repo_group = RepositoryGroup.objects.get_or_create(
        name="development",
        description=""
    )

    r = Repository.objects.create(
        dvcs_type="hg",
        name="fx-team",
        url="https://hg.mozilla.org/fx-team",
        active_status="active",
        codebase="gecko",
        repository_group=repo_group[0],
        description="",
        performance_alerts_enabled=True
    )
    return r

def store_resultset(jm, sample_data, resultset_sample, repository, jobs_ds):
    """
    Stores a number of jobs in the same resultset
    """
    num_jobs = 3
    resultset = resultset_sample
    jobs = sample_data.job_data

    # Only store data for the first resultset...
    resultset_creation = jm.store_result_set_data([resultset])

    blobs = []
    for index, blob in enumerate(jobs):
        # Modify job structure to sync with the resultset sample data
        if 'source' in blob:
            del blob['source']
        # skip log references since they don't work correctly in pending state.
        if 'log_references' in blob['job']:
            del blob['job']['log_references']
        blob['revision'] = resultset['revision']
        blob['revisions'] = resultset['revisions']
        blob['job']['state'] = 'pending'
        blobs.append(blob)

    # store and process the jobs so they are present in the tables.
    jm.store_job_data(blobs)
    return resultset_creation['inserted_result_set_ids'][0]

@pytest.fixture
def resultset_with_merge(jm_downstream, sample_data, downstream_resultset_sample,
                         downstream_repository, jobs_ds_downstream):
    return store_resultset(jm_downstream, sample_data,
            downstream_resultset_sample, downstream_repository,
            jobs_ds_downstream)

@pytest.fixture
def resultset_with_upstream(jm_upstream, sample_data, upstream_resultset_sample,
                            upstream_repository, jobs_ds_upstream):
    return store_resultset(jm_upstream, sample_data,
            upstream_resultset_sample, upstream_repository,
            jobs_ds_upstream)

@pytest.fixture
def resultset_with_normal(jm_downstream, sample_data, normal_resultset_sample,
                          downstream_repository, jobs_ds_downstream):
    return store_resultset(jm_downstream, sample_data,
            normal_resultset_sample, downstream_repository,
            jobs_ds_downstream)

@pytest.fixture
def downstream_alert_summary(downstream_repository, test_perf_framework,
                                  resultset_with_merge):
    from treeherder.perf.models import PerformanceAlertSummary
    return PerformanceAlertSummary.objects.create(
        repository=downstream_repository,
        framework=test_perf_framework,
        prev_result_set_id=resultset_with_merge - 1,
        result_set_id=resultset_with_merge,
        manually_created=False,
        last_updated=datetime.datetime.now())

@pytest.fixture
def upstream_alert_summary(upstream_repository, test_perf_framework,
                                resultset_with_upstream):
    from treeherder.perf.models import PerformanceAlertSummary
    return PerformanceAlertSummary.objects.create(
        repository=upstream_repository,
        framework=test_perf_framework,
        prev_result_set_id=resultset_with_upstream - 1,
        result_set_id=resultset_with_upstream,
        manually_created=False,
        last_updated=datetime.datetime.now())

@pytest.fixture
def regular_alert_summary(downstream_repository, test_perf_framework,
                               resultset_with_normal):
    from treeherder.perf.models import PerformanceAlertSummary
    return PerformanceAlertSummary.objects.create(
        repository=downstream_repository,
        framework=test_perf_framework,
        prev_result_set_id=resultset_with_normal - 1,
        result_set_id=resultset_with_normal,
        manually_created=False,
        last_updated=datetime.datetime.now())

def test_merge_regex():
    """Verify that the regex is able to handle multiple scenarios"""
    true_list = ["Merge m-c to fx-team a=merge CLOSED TREE",
                   "Merge mozilla-central to fx-team",
                   "merge fx-team to mozilla-central a=merge",
                   "Merge mozilla-central to mozilla-inbound"]
    for phrase in true_list:
        assert contains_word_merge(phrase) == True

def test_upstream_resultset(resultset_with_upstream):
    assert resultset_is_merge("fx-team", resultset_with_upstream) == False

def test_normal_resultset(resultset_with_normal):
    assert resultset_is_merge("mozilla-inbound", resultset_with_normal) == False

def test_downstream_resultset(resultset_with_merge):
    assert resultset_is_merge("mozilla-inbound", resultset_with_merge) == True

def test_downstream_summary(downstream_alert_summary):
    assert summary_is_merge(downstream_alert_summary) == True

def test_regular_alert_summary(regular_alert_summary):
    assert summary_is_merge(regular_alert_summary) == False

def test_upstream_alert_summary(upstream_alert_summary):
    assert summary_is_merge(upstream_alert_summary) == False

def test_classification(regular_alert_summary, downstream_alert_summary, upstream_alert_summary):
    assert classify_possible_downstream2(downsteam_alert_summary, [regular_alert_summary, upstream_alert_sumary]) == {}
