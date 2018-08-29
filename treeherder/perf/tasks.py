import newrelic.agent

from celery import task

from treeherder.model.models import Job, Push
from treeherder.perf.alerts import generate_new_alerts_in_series
from treeherder.perf.models import PerformanceSignature, PerformanceAlert
from treeherder.workers.task import retryable_task


@retryable_task(name='generate-alerts', max_retries=10)
def generate_alerts(signature_id):
    newrelic.agent.add_custom_parameter("signature_id", str(signature_id))
    signature = PerformanceSignature.objects.get(id=signature_id)
    generate_new_alerts_in_series(signature)


@task(name='check-confirming-perf-alerts')
def check_confirming_perf_alerts_status():
    from datetime import timedelta

    # fetch all "confirming" alerts
    # for each fetched alert:
    #   fetch 2 neighbouring changesets
    #   [any unfinished r/b jobs?] continue
    #   mark "confirmed"

    confirming_alerts = PerformanceAlert.objects.filter(status=PerformanceAlert.CONFIRMING)
    for alert in confirming_alerts:
        push = alert.summary.push
        one_day = timedelta(hours=24)
        _from, _to = push.time-one_day, push.time+one_day

        large_pushrange = Push.objects.filter(time__gte=_from, time_lte=_to).order_by('time')
        main_push_idx = large_pushrange.indexof(push)
        pushes_to_check = list(large_pushrange[main_push_idx-2:main_push_idx+2])

        for push in pushes_to_check:
            # fetch perf jobs having tests with alert's signature
            pending_perf_jobs = Job.objects.filter(push=push)
