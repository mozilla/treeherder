# To be deleted
import datetime
from treeherder.model.models import Repository, RepositoryGroup
from treeherder.model.models import (
    Option,
    OptionCollection,
    Push,
    MachinePlatform,
    JobGroup,
    JobType,
)
from treeherder.perf.models import (
    PerformanceAlert,
    PerformanceAlertSummary,
    PerformanceFramework,
    PerformanceSignature,
    PerformanceTag,
    BackfillReport,
    BackfillRecord,
    BackfillNotificationRecord,
)

RepositoryGroup.objects.get_or_create(name="development", description="")

repository = Repository.objects.get_or_create(
    dvcs_type="hg",
    name="TREEHERDER_TEST_REPOSITORY_NAME",
    url="https://hg.mozilla.org/mozilla-central",
    active_status="active",
    codebase="gecko",
    repository_group_id=1,
    description="",
    performance_alerts_enabled=True,
    tc_root_url="https://firefox-ci-tc.services.mozilla.com",
)

option = Option.objects.get_or_create(name='opt')

option_collection = OptionCollection.objects.get_or_create(
    option_collection_hash='my_option_hash',
    # option=option
)

windows_7_platform = MachinePlatform.objects.get_or_create(
    os_name='win', platform='win7', architecture='x86'
)

perf_framework = PerformanceFramework.objects.get_or_create(name='test_talos', enabled=True)

machine_platform = MachinePlatform.objects.get_or_create(
    os_name="my_os", platform="my_platform", architecture="x86"
)

signature = PerformanceSignature.objects.get_or_create(
    repository=repository[0],
    signature_hash=(40 * 't'),
    framework=perf_framework[0],
    platform=machine_platform[0],
    option_collection=option_collection[0],
    suite='mysuite',
    test='mytest',
    application='firefox',
    has_subtests=False,
    tags='warm pageload',
    extra_options='e10s opt',
    measurement_unit='ms',
    last_updated=datetime.datetime.now() - datetime.timedelta(days=42),
)

test_perf_tag = PerformanceTag.objects.get_or_create(name='harness')
for i in range(2):
    Push.objects.get_or_create(
        repository=repository,
        revision='1234abcd{}'.format(i),
        author='foo@bar.com',
        time=datetime.datetime.now(),
    )
performance_alert_summary = PerformanceAlertSummary.objects.get_or_create(
    repository=repository,
    framework=perf_framework,
    prev_push_id=1,
    push_id=2,
    manually_created=False,
    created=datetime.datetime.now(),
)
performance_alert_summary.performance_tags.add(test_perf_tag)

perf_alert = PerformanceAlert.objects.get_or_create(
    amount_abs=50.0,
    amount_pct=0.5,
    is_regression=True,
    new_value=150.0,
    prev_value=100.0,
    t_value=20.0,
    summary=performance_alert_summary,
    series_signature=signature,
)

report = BackfillReport.objects.get_or_create(summary=perf_alert.summary)

job_group = JobGroup.objects.get_or_create(
    symbol='Btime', name='Browsertime performance tests on Firefox'
)
job_type = JobType.objects.get_or_create(symbol='Bogo', name='Bogo tests')
record = BackfillRecord.objects.create(
    alert=perf_alert,
    report=report,
    job_type=job_type,
    job_group=job_group,
    job_tier=3232,
)

BackfillNotificationRecord.objects.create(record=record)
