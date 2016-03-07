web: newrelic-admin run-program gunicorn treeherder.config.wsgi:application --log-file - --timeout 29 --max-requests 2000
worker_beat: newrelic-admin run-program celery -A treeherder beat
worker_pushlog: newrelic-admin run-program celery -A treeherder worker -Q pushlog,fetch_missing_push_logs --maxtasksperchild=500 --concurrency=5
worker_buildapi_pending: newrelic-admin run-program celery -A treeherder worker -Q buildapi_pending --maxtasksperchild=20 --concurrency=5
worker_buildapi_running: newrelic-admin run-program celery -A treeherder worker -Q buildapi_running --maxtasksperchild=20 --concurrency=5
worker_buildapi_4hr: newrelic-admin run-program celery -A treeherder worker -Q buildapi_4hr --maxtasksperchild=20 --concurrency=1
worker_default: newrelic-admin run-program celery -A treeherder worker -Q default,cycle_data,calculate_durations,fetch_bugs,autoclassify,detect_intermittents,fetch_allthethings,generate_perf_alerts --maxtasksperchild=50 --concurrency=3
worker_hp: newrelic-admin run-program celery -A treeherder worker -Q classification_mirroring,publish_to_pulse --maxtasksperchild=50 --concurrency=1
worker_log_parser: newrelic-admin run-program celery -A treeherder worker -Q parse_job_logs,parse_job_logs_fail,parse_job_logs_hp,log_parser,log_parser_fail,log_parser_hp,log_parser_json,log_parser_json_fail,log_parser_json_hp,log_store_error_summary,log_store_error_summary_fail,log_store_error_summary_hp,log_after_parsed,log_after_parsed_fail,log_after_parsed_hp,log_crossreference_error_lines,log_crossreference_error_lines_fail,log_crossreference_error_lines_hp,log_autoclassify,log_autoclassify_fail,log_autoclassify_hp,error_summary --maxtasksperchild=50 --concurrency=5
release: ./manage.py migrate --noinput && ./manage.py load_initial_data && ./manage.py init_datasources
