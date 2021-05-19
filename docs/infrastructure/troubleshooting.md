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
  - MySQL/Redis client request stats:
    [prototype](https://rpm.newrelic.com/accounts/677903/applications/7385291/datastores) |
    [stage](https://rpm.newrelic.com/accounts/677903/applications/14179733/datastores) |
    [prod](https://rpm.newrelic.com/accounts/677903/applications/14179757/datastores)
- Google Cloud Console
  - [prod](https://console.cloud.google.com/kubernetes/list?project=moz-fx-treeherder-prod-c739)
  - [all other deployments](https://console.cloud.google.com/kubernetes/list?project=moz-fx-treeherde-nonprod-34ec)
  Most useful information can be found by clicking the workload tab and clicking on any "pod", which could be a cron job, celery task
  or the application. Select any one of those to access the container logs (select Container logs)
