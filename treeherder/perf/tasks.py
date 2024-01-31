import newrelic.agent

from treeherder.perf.alerts import generate_new_alerts_in_series
from treeherder.perf.models import PerformanceSignature
from treeherder.workers.task import retryable_task


@retryable_task(name="generate-alerts", max_retries=10)
def generate_alerts(signature_id):
    newrelic.agent.add_custom_attribute("signature_id", str(signature_id))
    signature = PerformanceSignature.objects.get(id=signature_id)
    generate_new_alerts_in_series(signature)
