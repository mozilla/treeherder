web: newrelic-admin run-program gunicorn treeherder.config.wsgi:application --log-file - --timeout 29 --max-requests 2000
worker_beat: newrelic-admin run-program celery -A treeherder beat
worker_pushlog: newrelic-admin run-program celery -A treeherder worker -Q pushlog --maxtasksperchild=500 --concurrency=5
worker_buildapi_pending: newrelic-admin run-program celery -A treeherder worker -Q buildapi_pending --maxtasksperchild=20 --concurrency=5
worker_buildapi_running: newrelic-admin run-program celery -A treeherder worker -Q buildapi_running --maxtasksperchild=20 --concurrency=5
worker_buildapi_4hr: newrelic-admin run-program celery -A treeherder worker -Q buildapi_4hr --maxtasksperchild=20 --concurrency=1
worker_store_pulse_jobs: newrelic-admin run-program celery -A treeherder worker -Q store_pulse_jobs --maxtasksperchild=20 --concurrency=1
worker_read_pulse_jobs: newrelic-admin run-program ./manage.py read_pulse_jobs
worker_default: newrelic-admin run-program celery -A treeherder worker -Q default,cycle_data,calculate_durations,fetch_bugs,detect_intermittents,fetch_allthethings,generate_perf_alerts --maxtasksperchild=50 --concurrency=3
worker_hp: newrelic-admin run-program celery -A treeherder worker -Q classification_mirroring,publish_to_pulse --maxtasksperchild=50 --concurrency=1
worker_log_parser: newrelic-admin run-program celery -A treeherder worker -Q log_parser,log_parser_fail,log_store_failure_lines,log_store_failure_lines_fail,log_crossreference_error_lines,log_crossreference_error_lines_fail,log_autoclassify,log_autoclassify_fail,error_summary --maxtasksperchild=50 --concurrency=5

release: ./bin/pre_deploy
