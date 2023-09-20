# Infrastructure Troubleshooting

Any infrastructure, data ingestion or database issues will need to be handled by cloudOps, who provide on-call support (however the resources listed below can be used to help them identify root causes when its not obvious).

For urgent issues, ping whomever is listed as main contact in #treeherder-ops slack channel. If those listed as contacts are not working when an emergency occurs, follow [these procedures](https://mana.mozilla.org/wiki/display/SVCOPS) to contact whomever is on-call.

For less urgent issues or general support, you can file a bug with [cloudOps](https://bugzilla.mozilla.org/enter_bug.cgi?product=Cloud%20Services&component=Operations%3A%20Releng).

## Monitoring & metrics

- New Relic
  - Overview:
    [prototype](https://rpm.newrelic.com/accounts/677903/applications/7385291) |
    [stage](https://rpm.newrelic.com/accounts/677903/applications/14179733) |
    [prod](https://rpm.newrelic.com/accounts/677903/applications/14179757)
  - Error analytics:
    [prototype](https://rpm.newrelic.com/accounts/677903/applications/7385291/filterable_errors) |
    [stage](https://rpm.newrelic.com/accounts/677903/applications/14179733/filterable_errors) |
    [prod](https://rpm.newrelic.com/accounts/677903/applications/14179757/filterable_errors)
  - Web transactions:
    [prototype](https://rpm.newrelic.com/accounts/677903/applications/7385291/transactions?type=app) |
    [stage](https://rpm.newrelic.com/accounts/677903/applications/14179733/transactions?type=app) |
    [prod](https://rpm.newrelic.com/accounts/677903/applications/14179757/transactions?type=app)
  - Non-web transactions (background tasks):
    [prototype](https://rpm.newrelic.com/accounts/677903/applications/7385291/transactions?type=other&show_browser=false) |
    [stage](https://rpm.newrelic.com/accounts/677903/applications/14179733/transactions?type=other&show_browser=false) |
    [prod](https://rpm.newrelic.com/accounts/677903/applications/14179757/transactions?type=other&show_browser=false)
  - Postgres/Redis client request stats:
    [prototype](https://rpm.newrelic.com/accounts/677903/applications/7385291/datastores) |
    [stage](https://rpm.newrelic.com/accounts/677903/applications/14179733/datastores) |
    [prod](https://rpm.newrelic.com/accounts/677903/applications/14179757/datastores)
- Google Cloud Console
  - [prod](https://console.cloud.google.com/kubernetes/list?project=moz-fx-treeherder-prod-c739)
  - [all other deployments](https://console.cloud.google.com/kubernetes/list?project=moz-fx-treeherde-nonprod-34ec)
  Most useful information can be found by clicking the workload tab and clicking on any "pod", which could be a cron job, celery task
  or the application. Select any one of those to access the container logs (select Container logs)

## Scenarios

A general approach to troubleshooting is to look in New Relic in the errors tab for treeherder-production and the gcp console (logs can be found in the console). For specific data ingestion issues, follow the steps below:

### Celery queue backlogs

If push, task or log parsing is slow or has stopped, it could indicate a backlog with any of the associated workers or it could
indicate some other error.

1. A cloudOps team member should check CloudAMQP "RabbitMQ Manager" dashboard to check the per-queue breakdown
   of incoming and delivery message rates.
2. Check New Relic's "Error Analytics" section, in case tasks are failing and being
   retried due to a Python exception.
3. In the New Relic's "Transactions" section, switch to the "Non-web" transactions view
   (or use the direct links above), and click the relevant Celery task to see if there
   has been a change in either throughput or time per task.
4. Depending on the information discovered above, you may want to try scaling resources or fixing any errors
   causing the backlogged queues.

### New pushes or jobs not appearing

If new pushes or CI job results are not appearing in Treeherder's UI:

1. Follow the steps in [Celery queue backlogs](#celery-queue-backlogs) to rule out
   task backlogs/Python exceptions.
2. Check the upstream Pulse queues [using Pulse Guardian] (you must be an co-owner of
   the Treeherder queues to see them listed). If there is a Pulse queue backlog,
   it suggests that Treeherder's `pulse_listener_{pushes,jobs}` workers have stopped
   consuming Pulse events and a cloudOps team member will need to investigate if the
   cause is infrastructure-related.
3. Failing that, it's possible the issue might lie in the services that send events to
   those Pulse exchanges, such as `taskcluster-github` or
   the Taskcluster systems upstream of those. Ask for help in the Slack channel
   `#taskcluster-cloudops`.

[using pulse guardian]: https://pulseguardian.mozilla.org/queues
