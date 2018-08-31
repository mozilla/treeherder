import newrelic.agent
from celery import task
from datetime import timedelta

from treeherder.model.models import Job, Push
from treeherder.perf.alerts import generate_new_alerts_in_series
from treeherder.perf.models import PerformanceSignature, PerformanceAlert, PerformanceDatum
from treeherder.workers.task import retryable_task


@retryable_task(name='generate-alerts', max_retries=10)
def generate_alerts(signature_id):
    newrelic.agent.add_custom_parameter("signature_id", str(signature_id))
    signature = PerformanceSignature.objects.get(id=signature_id)
    generate_new_alerts_in_series(signature)


@task(name='check-confirming-perf-alerts')
def check_confirming_perf_alerts_status():
    # TODO: what's this for? do I need it?
    # newrelic.agent.add_custom_parameter("signature_id", str(signature_id))
    one_day = timedelta(hours=24)

    def traceback_producer_job_type(perf_alert):
        push = perf_alert.summary.push
        signature = perf_alert.series_signature

        associated_perf_datum = PerformanceDatum.objects.filter(push=push, signature=signature).first()
        return associated_perf_datum.job.job_type if associated_perf_datum else None

    def extract_pushes_to_check(many_nearby_pushes, alert_push, push_range=2):
        many_nearby_pushes = list(many_nearby_pushes)

        alert_push_idx = None
        for index, push in enumerate(many_nearby_pushes):
            if alert_push.id == push.id:
                alert_push_idx = index
                break

        try:
            from_ = alert_push_idx - push_range
            from_ = from_ if from_ > 0 else 0
            to_ = alert_push_idx + push_range

            return list(many_nearby_pushes[from_:to_])
        except TypeError:
            # Error: list wasn't properly queried for
            return []

    confirming_alerts = PerformanceAlert.objects.filter(status=PerformanceAlert.CONFIRMING)
    for alert in confirming_alerts:
        alert_push = alert.summary.push
        _from, _to = alert_push.time-one_day, alert_push.time+one_day

        job_type = traceback_producer_job_type(alert)
        if job_type is None:
            # Warning
            continue

        many_nearby_pushes = Push.objects.filter(time__gte=_from, time__lte=_to).order_by('time')
        pushes_to_check = extract_pushes_to_check(many_nearby_pushes, alert_push)

        has_pending_jobs = False
        for push in pushes_to_check:
            pending_perf_jobs_exist = Job.objects.filter(
                push=push, job_type=job_type, autoclassify_status=Job.PENDING).exists()
            if pending_perf_jobs_exist:
                has_pending_jobs = True
                break

        if not has_pending_jobs:
            alert.status = PerformanceAlert.CONFIRMED
            alert.save()
