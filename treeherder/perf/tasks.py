from celery import task

from treeherder.perf.alerts import generate_new_alerts_in_series
from treeherder.perf.models import PerformanceSignature


@task(name='generate-perf-alerts', ignore_result=True)
def generate_alerts(signature_id):
    signature = PerformanceSignature.objects.get(id=signature_id)
    generate_new_alerts_in_series(signature)
