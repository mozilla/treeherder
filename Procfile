web: newrelic-admin run-program gunicorn treeherder.webapp.wsgi:application --log-file - --timeout 29 --max-requests 1000
worker_beat: newrelic-admin run-program celery -A treeherder beat
worker_pushlog: newrelic-admin run-program celery -A treeherder worker -Q pushlog,fetch_missing_push_logs
worker_buildapi: newrelic-admin run-program celery -A treeherder worker -Q buildapi