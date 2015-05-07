web: gunicorn treeherder.webapp.wsgi:application --log-file - --timeout 29 --max-requests 1000
worker_beat: celery -A treeherder beat
worker_pushlog: celery -A treeherder worker -Q pushlog,fetch_missing_push_logs
