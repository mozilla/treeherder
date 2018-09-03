import newrelic.agent
from celery import task

from treeherder.perf.alerts import (check_confirming_perf_alerts_status,
                                    generate_new_alerts_in_series)
from treeherder.perf.models import PerformanceSignature
from treeherder.workers.task import retryable_task


@retryable_task(name='generate-alerts', max_retries=10)
def generate_alerts(signature_id):
    newrelic.agent.add_custom_parameter("signature_id", str(signature_id))
    signature = PerformanceSignature.objects.get(id=signature_id)
    generate_new_alerts_in_series(signature)


@task(name='check-confirming-perf-alerts')
def check_confirming_perf_alerts():
    check_confirming_perf_alerts_status()
