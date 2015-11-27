from celery import task

from treeherder.perf.alerts import generate_new_alerts_in_series


@task(name='generate-alerts')
def generate_alerts(signature):
    generate_new_alerts_in_series(signature)
