web: gunicorn treeherder.webapp.wsgi:application
worker: celery -A treeherder worker -c 3 -Q default -n default.%h
worker_buildapi: celery -A treeherder worker -Q buildapi --concurrency 5 --maxtasksperchild=10 -n buildapi.%h
worker_gevent: celery -A treeherder worker -Q log_parser_fail,log_parser,log_parser -P gevent --concurrency=10 --maxtasksperchild=500 -n log_parser.%h
worker_hp: celery -A treeherder worker -c 1 -Q high_priority -E --maxtasksperchild=500 -n hp.%h
worker_pushlog: celery -A treeherder worker -Q pushlog -P gevent --concurrency=5 --maxtasksperchild=500 -n pushlog.%h
beat: celery -A treeherder beat
worker_pulse: python manage.py start_pulse_consumer
