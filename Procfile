# This file defines the processes that will be run on Heroku.
# Each line must be in the format `<process type>: <command>`.
# https://devcenter.heroku.com/articles/how-heroku-works#knowing-what-to-execute
# https://devcenter.heroku.com/articles/procfile

# The `release` process type specifies the command to run during deployment, and is where
# we run DB migrations and other tasks that are 'release' rather than 'build' specific:
# https://devcenter.heroku.com/articles/release-phase
# https://devcenter.heroku.com/articles/runtime-principles#build-release-run
release: ./bin/pre_deploy

# The `web` process type is the only one that receives external traffic from Heroku's routers.
# We set the maximum request duration to 20 seconds, to ensure that poorly performing API
# queries do not consume a gunicorn worker for unbounded lengths of time. See:
# https://devcenter.heroku.com/articles/python-gunicorn
# The Heroku Python buildpack sets some sensible gunicorn defaults via environment variables:
# https://github.com/heroku/heroku-buildpack-python/blob/master/vendor/python.gunicorn.sh
# https://github.com/heroku/heroku-buildpack-python/blob/master/vendor/WEB_CONCURRENCY.sh
# TODO: Experiment with different dyno sizes and gunicorn concurrency/worker types (bug 1175472).
web: newrelic-admin run-program gunicorn treeherder.config.wsgi:application --timeout 100

# All other process types can have arbitrary names.
# The Celery options such as `--without-heartbeat` are from the recommendations here:
# https://www.cloudamqp.com/docs/celery.html
# The REMAP_SIGTERM is as recommended by:
# https://devcenter.heroku.com/articles/celery-heroku#using-remap_sigterm

# This schedules (but does not run itself) the cron-like tasks listed in `CELERY_BEAT_SCHEDULE`.
# However we're moving away from using this in favour of the Heroku scheduler addon.
# NB: This should not be scaled up to more than 1 dyno otherwise duplicate tasks will be scheduled.
# TODO: Move the remaining tasks to the addon and remove this process type (deps of bug 1176492).
celery_scheduler: REMAP_SIGTERM=SIGQUIT newrelic-admin run-program celery beat -A treeherder

# Push/job data is consumed from exchanges on pulse.mozilla.org using these kombu-powered
# Django management commands. They do not ingest the data themselves, instead adding tasks
# to the `store_pulse_{pushes,jobs}` queues for `worker_store_pulse_data` to process.
# NB: These should not be scaled up to more than 1 of each.
# TODO: Merge these two listeners into one since they use so little CPU each (bug 1530965).
pulse_listener_pushes: newrelic-admin run-program ./manage.py pulse_listener_pushes
pulse_listener_tasks: newrelic-admin run-program ./manage.py pulse_listener_tasks

# Processes pushes/jobs from Pulse that were collected by `pulse_listener_{pushes,tasks}`.
worker_store_pulse_data: REMAP_SIGTERM=SIGQUIT newrelic-admin run-program celery worker -A treeherder --without-gossip --without-mingle --without-heartbeat -Q store_pulse_pushes,store_pulse_tasks --concurrency=3

# Handles the log parsing tasks scheduled by `worker_store_pulse_data` as part of job ingestion.
worker_log_parser: REMAP_SIGTERM=SIGQUIT newrelic-admin run-program celery worker -A treeherder --without-gossip --without-mingle --without-heartbeat -Q log_parser --concurrency=7
worker_log_parser_fail_raw_sheriffed: REMAP_SIGTERM=SIGQUIT newrelic-admin run-program celery worker -A treeherder --without-gossip --without-mingle --without-heartbeat -Q log_parser_fail_raw_sheriffed --concurrency=1
worker_log_parser_fail_raw_unsheriffed: REMAP_SIGTERM=SIGQUIT newrelic-admin run-program celery worker -A treeherder --without-gossip --without-mingle --without-heartbeat -Q log_parser_fail_raw_unsheriffed --concurrency=1
worker_log_parser_fail_json_sheriffed: REMAP_SIGTERM=SIGQUIT newrelic-admin run-program celery worker -A treeherder --without-gossip --without-mingle --without-heartbeat -Q log_parser_fail_json_sheriffed --concurrency=7
worker_log_parser_fail_json_unsheriffed: REMAP_SIGTERM=SIGQUIT newrelic-admin run-program celery worker -A treeherder --without-gossip --without-mingle --without-heartbeat -Q log_parser_fail_json_unsheriffed --concurrency=7

# Tasks that don't need a dedicated worker.
worker_misc: REMAP_SIGTERM=SIGQUIT newrelic-admin run-program celery worker -A treeherder --without-gossip --without-mingle --without-heartbeat -Q default,generate_perf_alerts,pushlog,seta_analyze_failures --concurrency=3
