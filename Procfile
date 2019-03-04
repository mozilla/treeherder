# This file defines the processes that will be run on Heroku.
# Each line must be in the format `<process type>: <command>`.
# https://devcenter.heroku.com/articles/how-heroku-works#knowing-what-to-execute
# https://devcenter.heroku.com/articles/procfile

# The `release` process type specifies the command to run during deployment, and is where
# we run DB migrations and other tasks that are 'release' rather than 'build' specific:
# https://devcenter.heroku.com/articles/release-phase
# https://12factor.net/build-release-run
release: ./bin/pre_deploy

# The `web` process type is the only one that receives external traffic from Heroku's routers.
# We set the maximum request duration to 20 seconds, to ensure that poorly performing API
# queries do not consume a gunicorn worker for unbounded lengths of time. See:
# https://devcenter.heroku.com/articles/python-gunicorn
# The Heroku Python buildpack sets some sensible gunicorn defaults via environment variables:
# https://github.com/heroku/heroku-buildpack-python/blob/master/vendor/python.gunicorn.sh
# TODO: Experiment with different dyno sizes and gunicorn concurrency/worker types (bug 1175472).
web: newrelic-admin run-program gunicorn treeherder.config.wsgi:application --timeout 20

# All other process types can have arbitrary names.
# The Celery options such as `--without-heartbeat` are from the recommendations here:
# https://www.cloudamqp.com/docs/celery.html
# The REMAP_SIGTERM is as recommended by:
# https://devcenter.heroku.com/articles/celery-heroku#using-remap_sigterm

# This schedules (but does not run itself) the cron-like tasks listed in `CELERYBEAT_SCHEDULE`.
# However we're moving away from using this in favour of the Heroku scheduler addon.
# TODO: Move the remaining tasks to the addon and remove this process type (deps of bug 1176492).
celery_scheduler: REMAP_SIGTERM=SIGQUIT newrelic-admin run-program celery beat -A treeherder

# Push/job data is consumed from exchanges on pulse.mozilla.org using these kombu-powered
# Django management commands. They do not ingest the data themselves, instead adding tasks
# to the `store_pulse_{pushes,jobs}` queues for `worker_store_pulse_data` to process.
# NB: These should not be scaled up to more than 1 of each.
# TODO: Merge these two listeners into one since they use so little CPU each.
pulse_listener_pushes: newrelic-admin run-program ./manage.py pulse_listener_pushes
pulse_listener_jobs: newrelic-admin run-program ./manage.py pulse_listener_jobs

# Processes pushes/jobs from Pulse that were collected by `pulse_listener_{pushes,jobs)`.
worker_store_pulse_data: REMAP_SIGTERM=SIGQUIT newrelic-admin run-program celery worker -A treeherder --without-gossip --without-mingle --without-heartbeat -Q store_pulse_pushes,store_pulse_jobs --concurrency=3

# Handles the log parsing tasks scheduled by `worker_store_pulse_data` as part of job ingestion.
# TODO: Figure out the memory leak and remove the `--maxtasksperchild` (bug 1513506).
worker_log_parser: REMAP_SIGTERM=SIGQUIT newrelic-admin run-program celery worker -A treeherder --without-gossip --without-mingle --without-heartbeat -Q log_parser,log_parser_fail,log_autoclassify,log_autoclassify_fail --maxtasksperchild=50 --concurrency=7

# Tasks that don't need a dedicated worker.
worker_misc: REMAP_SIGTERM=SIGQUIT newrelic-admin run-program celery worker -A treeherder --without-gossip --without-mingle --without-heartbeat -Q default,generate_perf_alerts,pushlog,seta_analyze_failures --concurrency=3
