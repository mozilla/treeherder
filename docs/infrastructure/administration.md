# Infrastructure administration

## Obtaining access

- Heroku: Follow the [Mozilla Heroku SSO guide] to join the enterprise account,
  then ask a Treeherder team member who has `manage` permissions to invite you to
  the Heroku apps.
- Amazon RDS: File a [Treeherder infrastructure bug] requesting access to the
  `moz-devservices` AWS account and needinfo `:dividehex`, who will update the
  [IAM configuration file][iam-config].
- New Relic: The Treeherder team will need to [send an invite][new-relic-invite].
- Papertrail: The Treeherder team will need to [send an invite][papertrail-invite].

[mozilla heroku sso guide]: https://mana.mozilla.org/wiki/display/TS/Using+SSO+with+your+Heroku+account
[treeherder infrastructure bug]: https://bugzilla.mozilla.org/enter_bug.cgi?product=Tree%20Management&component=Treeherder%3A%20Infrastructure
[new-relic-invite]: https://account.newrelic.com/accounts/677903/users
[papertrail-invite]: https://papertrailapp.com/account/members

## Heroku

Treeherder has three Heroku apps, which can be managed via the web dashboard or CLI:

- [treeherder-prototype](https://dashboard.heroku.com/apps/treeherder-prototype)
- [treeherder-stage](https://dashboard.heroku.com/apps/treeherder-stage)
- [treeherder-prod](https://dashboard.heroku.com/apps/treeherder-prod)

### Using the Heroku CLI

Whilst most Heroku administration is possible using the Heroku website, it is often quicker
to perform tasks using the [Heroku CLI]. After installing it, run `heroku login` to login
(Note: Since Mozilla's Enterprise Heroku account uses SSO, sessions only last 8 hours).

[heroku cli]: https://devcenter.heroku.com/articles/heroku-cli

Commands can then be run against a particular app like so:

```bash
heroku config --app treeherder-stage
```

For the list of available CLI commands, see the [CLI Usage] page or run `heroku help`.

[cli usage]: https://devcenter.heroku.com/articles/using-the-cli

<!-- prettier-ignore -->
!!! tip
    Since Treeherder has multiple Heroku apps, the Heroku CLI feature that allows linking a single
    app to the local Git repository (to save having to pass `--app` each time) is not helpful.
    Instead, we recommend adding aliases similar to the following to your bash profile:

```bash
alias thd='HEROKU_APP=treeherder-prototype heroku'
alias ths='HEROKU_APP=treeherder-stage heroku'
alias thp='HEROKU_APP=treeherder-prod heroku'
```  

This allows commands to be run against a specific app with minimal typing:

```bash
ths config
```

### Deploying Treeherder

Deployments occur via Heroku's [GitHub integration] feature, with prototype/stage typically
set to auto-deploy from the `master` branch, and production from the `production` branch.
This is controlled via the "deploy" tab in the Heroku app dashboard:
[prototype][deploy-prototype] | [stage][deploy-stage] | [prod][deploy-prod].
A comparison of the Git revisions deployed to each environment can be seen using [What's Deployed].

After a push is made to an auto-deployed branch, Heroku will wait for the successful completion of
the [Travis CI build] (taking approximately 8 minutes), before initiating the deployment process.
The steps described in [deployment lifecycle] then occur, which take about 5 minutes.

Once the deployment is complete, `heroku-bot` will comment in the `#treeherder` IRC channel,
and for production, an email is sent to the [tools-treeherder] mailing list. Recent deployment
activity can also be seen on the "activity" tab in the Heroku dashboard for each app.

[github integration]: https://devcenter.heroku.com/articles/github-integration
[deploy-prototype]: https://dashboard.heroku.com/apps/treeherder-prototype/deploy/github
[deploy-stage]: https://dashboard.heroku.com/apps/treeherder-stage/deploy/github
[deploy-prod]: https://dashboard.heroku.com/apps/treeherder-prod/deploy/github
[what's deployed]: https://whatsdeployed.io/s-dqv
[travis ci build]: https://travis-ci.org/mozilla/treeherder/builds
[deployment lifecycle]: architecture.md#deployment-lifecycle
[tools-treeherder]: https://lists.mozilla.org/listinfo/tools-treeherder

<!-- prettier-ignore -->
!!! tip
    To simplify pushing latest `master` to the `production` branch, use this bash alias:

```bash
# Replace `origin` with the remote name of the upstream Treeherder repository, if different.
alias deploy='git fetch --all --prune && git push origin remotes/origin/master:production'
```

It pushes directly from the `remotes/origin/master` Git metadata branch, meaning the
command works even when the local `master` branch isn't up to date and does not disturb
the locally checked out branch or working directory.

<!-- prettier-ignore -->
!!! warning
    Since we use the GitHub integration feature, never use the `git push heroku master`
    approach shown in the Heroku tutorials, otherwise the deployed app state won't match
    the repository branches.

### Reverting deployments

Deployments can be reverted by either:

- Performing a [rollback] using the Heroku web dashboard (via the "activity" tab) or else
  using the `heroku rollback` CLI command.
- Initiating a new deployment with the former code revision.

Performing a rollback is faster since it re-uses the previously generated app slug so skips
the build step. However if auto-deploy from a Git branch (eg `production`) is enabled, then
one must remember to fix the issue before the next push to that branch, otherwise the
rollback will be overwritten by a newer still-broken release.

[rollback]: https://devcenter.heroku.com/articles/releases#rollback

### Restarting dynos

Heroku's web dashboard can be used to restart all dynos (via the "more" menu top right),
or else the [heroku ps:restart] command can be used to restart all/some dyno types.

[heroku ps:restart]: https://devcenter.heroku.com/articles/heroku-cli-commands#heroku-ps-restart-dyno

### Scaling dynos

To change the quantity or [type][dyno-types] (size) of dyno being used for a particular
process type, see Heroku's [scaling] documentation.

If changing the dyno type, it may be necessary to adjust the command's concurrency to make
full use of a larger dyno's resources, or conversely to avoid exhausting the RAM of a
smaller instance size.

For gunicorn concurrency is controlled via the `WEB_CONCURRENCY` environment variable, and
for Celery via the `--concurrency` CLI option. See the comments in Treeherder's [Procfile]
for more details.

[dyno-types]: https://devcenter.heroku.com/articles/dyno-types
[scaling]: https://devcenter.heroku.com/articles/scaling#manual-scaling
[procfile]: https://github.com/mozilla/treeherder/blob/master/Procfile

### Running one-off commands

Ad-hoc commands can be run against an application using [one-off dynos] that are
spun up for the duration of the command and then destroyed after.

For example to start an interactive bash shell on stage:

```bash
heroku run --app treeherder-stage -- bash
```

Or to run a detached Django management command against prod using a larger dyno size:

```bash
heroku run:detached --app treeherder-prod --size=standard-2x -- ./manage.py ...
```

[one-off dynos]: https://devcenter.heroku.com/articles/one-off-dynos

### Resetting the Redis cache

The Redis cache can be reset by running `./manage.py clear_cache` as a one-off
command against the app that owns the [Heroku Redis] add-on in question.

[heroku redis]: https://devcenter.heroku.com/articles/heroku-redis

### Adjusting scheduled tasks

Tasks are run on a schedule via either Heroku's [scheduler addon] or a Celery beat process
(see [background tasks] for more details).

Unfortunately the scheduler addon cannot currently be configured via code or CLI, so changes
must be made via the addon's web UI for each Heroku app separately. This can be accessed
through the "resources" tab of each Heroku app, or via these direct links:
[prototype][scheduler-prototype] | [stage][scheduler-stage] | [prod][scheduler-prod].

[scheduler addon]: https://devcenter.heroku.com/articles/scheduler
[background tasks]: architecture.md#background-tasks
[scheduler-prototype]: https://addons-sso.heroku.com/apps/treeherder-prototype/addons/scheduler
[scheduler-stage]: https://addons-sso.heroku.com/apps/treeherder-stage/addons/scheduler
[scheduler-prod]: https://addons-sso.heroku.com/apps/treeherder-prod/addons/scheduler

### Environment variables

App-specific configuration is controlled through the use of environment variables.
These can be managed via the "settings" tab of the Heroku app's web dashboard, or with
the `heroku config` command. See [managing config variables].

[managing config variables]: https://devcenter.heroku.com/articles/config-vars#managing-config-vars

## Amazon RDS

The MySQL instances used by Treeherder can be found on the [AWS us-east-1 RDS console],
after logging in with the account ID `moz-devservices` and then [your IAM username & password].

[aws us-east-1 rds console]: https://console.aws.amazon.com/rds/home?region=us-east-1#databases:
[your iam username & password]: #obtaining-access

<!-- prettier-ignore -->
!!! note
For the `treeherder-prod` and `treeherder-stage` Heroku apps, their RDS instances have the
same name as the app. However for `treeherder-prototype` the RDS instance is instead called
`treeherder-dev`.
There is also a read-only replica of production, named
`treeherder-prod-ro`.

### Connecting to RDS instances

Connections **must** be made using TLS otherwise the connection will fail, but not before
having already leaked the credentials over plain-text.

A tool such as [MySQL Workbench] is recommended, since it's possible to save connection
settings for each RDS instance, speeding up future use and reducing the chance of forgetting
to enable TLS.

When setting up a connection make sure to change the "Use SSL" option to `require` and set
the "SSL CA File" option to point at the AWS public CA certificate, which for convenience can
be used [directly from the Treeherder repository][aws-rds-cert]. If using another MySQL client,
see the [RDS SSL docs] for more details.

The public instance hostnames can be found via the [RDS console][aws us-east-1 rds console]
or the `DATABASE_URL` environment variable. If accessing production it's strongly recommended
to connect to the read-only replica (`treeherder-prod-ro`) to avoid accidental changes or
inadvertent DB load, unless write access is specifically required. The replica uses the same
credentials as the master production instance.

[mysql workbench]: https://www.mysql.com/products/workbench/
[aws-rds-cert]: https://github.com/mozilla/treeherder/blob/master/deployment/aws/rds-combined-ca-bundle.pem
[rds ssl docs]: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_MySQL.html#MySQL.Concepts.SSLSupport

### Resetting dev/stage to a recent production snapshot

The `treeherder-dev` and `treeherder-stage` RDS instances do not have regular user/sheriff
interactions that provide certain sets of data (for example classifications of failures).

As such it can be useful to periodically reset them using the latest daily production snapshot.
This has to be performed by an admin of the `moz-devservices` AWS account, and can be requested
by filing a bug similar to [bug 1469837].

After an instance is reset:

- The password for the MySQL user `th_admin` must be updated to match the one in `DATABASE_URL`
  for that Heroku app (since the production password will have been inherited from the snapshot,
  which won't match). See [Changing MySQL passwords].
- [Perform a deployment] of the Heroku app, which will ensure that the Django migration and
  code state are in sync (in case `master` has new migrations not yet seen on production).
- [Reset the app's Redis cache]

[bug 1469837]: https://bugzilla.mozilla.org/show_bug.cgi?id=1469837
[changing mysql passwords]: #changing-mysql-passwords
[perform a deployment]: #deploying-treeherder
[reset the app's redis cache]: #resetting-the-redis-cache

### Creating a temporary instance

To create a new RDS instance based on the latest daily production DB snapshot:

1. Ensure a bug is filed, which will act as a reminder to delete the instance later.
2. Go to the [us-east-1 RDS snapshots page].
3. Select the most recent `treeherder-prod` snapshot.
4. From the "Actions" menu choose "Restore snapshot".
5. Set the following options (leaving others at their defaults):
   - DB instance class: `db.m4.xlarge` (same as dev/stage)
   - DB instance identifier: `treeherder-dev-bug<NNNNNN>`
   - Virtual private cloud: `treeherder-prod-vpc`
   - Subnet group: `treeherder-dbgrp` (press the VPC refresh button to get this to appear)
   - Public accessibility: Yes
   - DB parameter group: `treeherder-mysql57`
6. Select "Restore DB Instance".
7. Wait 15-20 minutes for the instance to be created and report status as "Available".
8. Select the instance, click "Modify", and then:
   - Enter a randomly generated 30+ character password in the "New master password" field.
   - In the "Security group" section, replace the default group with `treeherder_heroku-sg`.
9. Press "Continue" to submit the changes. If the page doesn't submit due to a JavaScript
   exception, try using the deprecated [classic AWS UI] instead.
10. Make a note of the DB hostname recorded under `Endpoint`. It will be in the form
    `treeherder-dev-bugNNNNNN.HASH.us-east-1.rds.amazonaws.com`.

To use the new instance locally, run this inside the Vagrant shell:

```bash
export DATABASE_URL='mysql://th_admin:PASSWORD@HOSTNAME/treeherder'
```

Our Django database configuration automatically enables TLS with non-localhost hostnames.

[us-east-1 rds snapshots page]: https://console.aws.amazon.com/rds/home?region=us-east-1#db-snapshots:
[classic aws ui]: https://console.aws.amazon.com/rds/home?region=us-east-1&skin=classic#dbinstances:

### Granting access to the read-only replica

One of the ways in which we allow users to [access Treeherder data](../accessing_data.md)
is via direct access to our read-only RDS MySQL replica. Both ActiveData and Mozilla's
ReDash instance use this approach.

NOTE: Don't forget to try running `./manage.py runserver` with the user created before sending credentials to the user.

NOTE2: Certain symbols (e.g. '%') in a password would work via MySql, however, fail via Django

Each user should be given a unique MySQL username, created by [connecting](#connecting-to-rds-instances)
to the master production RDS instance (not the replica) and running these SQL statements:

```sql
-- Adjust the username and password accordingly.
CREATE USER 'myuser' IDENTIFIED BY 'PASSWORD >=30 CHARACTERS LONG' REQUIRE SSL;

-- Tables where we want to allow only partial access.
-- `password` is randomly generated by Django and never used/exposed due to SSO,
-- so is not really sensitive, but it causes less confusion to still exclude it.
GRANT SELECT (id, username, email) ON treeherder.auth_user to 'myuser';

-- Tables containing no sensitive data.
GRANT SELECT ON treeherder.backfill_record to 'myuser';
GRANT SELECT ON treeherder.backfill_report to 'myuser';
GRANT SELECT ON treeherder.bug_job_map to 'myuser';
GRANT SELECT ON treeherder.bugscache to 'myuser';
GRANT SELECT ON treeherder.build_platform to 'myuser';
GRANT SELECT ON treeherder.classified_failure to 'myuser';
GRANT SELECT ON treeherder.commit to 'myuser';
GRANT SELECT ON treeherder.failure_classification to 'myuser';
GRANT SELECT ON treeherder.failure_line to 'myuser';
GRANT SELECT ON treeherder.group to 'myuser';
GRANT SELECT ON treeherder.group_failure_lines to 'myuser';
GRANT SELECT ON treeherder.issue_tracker to 'myuser';
GRANT SELECT ON treeherder.job to 'myuser';
GRANT SELECT ON treeherder.job_detail to 'myuser';
GRANT SELECT ON treeherder.job_group to 'myuser';
GRANT SELECT ON treeherder.job_log to 'myuser';
GRANT SELECT ON treeherder.job_note to 'myuser';
GRANT SELECT ON treeherder.job_type to 'myuser';
GRANT SELECT ON treeherder.machine to 'myuser';
GRANT SELECT ON treeherder.machine_platform to 'myuser';
GRANT SELECT ON treeherder.option to 'myuser';
GRANT SELECT ON treeherder.option_collection to 'myuser';
GRANT SELECT ON treeherder.performance_alert to 'myuser';
GRANT SELECT ON treeherder.performance_alert_summary to 'myuser';
GRANT SELECT ON treeherder.performance_bug_template to 'myuser';
GRANT SELECT ON treeherder.performance_datum to 'myuser';
GRANT SELECT ON treeherder.performance_framework to 'myuser';
GRANT SELECT ON treeherder.performance_signature to 'myuser';
GRANT SELECT ON treeherder.product to 'myuser';
GRANT SELECT ON treeherder.push to 'myuser';
GRANT SELECT ON treeherder.reference_data_signatures to 'myuser';
GRANT SELECT ON treeherder.repository to 'myuser';
GRANT SELECT ON treeherder.repository_group to 'myuser';
GRANT SELECT ON treeherder.seta_jobpriority to 'myuser';
GRANT SELECT ON treeherder.taskcluster_metadata to 'myuser';
GRANT SELECT ON treeherder.text_log_error to 'myuser';
GRANT SELECT ON treeherder.text_log_error_match to 'myuser';
GRANT SELECT ON treeherder.text_log_error_metadata to 'myuser';
GRANT SELECT ON treeherder.text_log_step to 'myuser';
```

Afterwards provide the user with the newly created credentials and the hostname of the
read-only replica (`treeherder-prod-ro.<HASH>.us-east-1.rds.amazonaws.com`), making sure
to emphasise the need to [connect using TLS](#connecting-to-rds-instances).

<!-- prettier-ignore -->
!!! warning
    These credentials will also work on the master production instance, so take care to
    provide the hostname of the replica and not the master - or their queries will run on
    the instance used by Treeherder, affecting its performance.

When tables are added/removed, an updated set of grant statements should be generated using
the following SQL:

```sql
SELECT CONCAT('GRANT SELECT ON ', table_schema, '.', table_name, ' to ''myuser'';') AS grant_stmt
FROM information_schema.TABLES
WHERE table_schema = 'treeherder'
AND table_name NOT REGEXP 'django_|auth_';
```

<!-- prettier-ignore -->
!!! note
    For new tables the appropriate `GRANT SELECT` statement will need to be manually run for existing
    read-only accounts (this is particularly important for the `activedata` and `redash` users).

### Changing MySQL passwords

To change the password for a MySQL account on an RDS instance:

1. [Connect to the instance](#connecting-to-rds-instances) using the `th_admin` user.
2. Set the new password [according to the MySQL documentation].

   For example to change the current user's password:

   ```sql
   SET PASSWORD = 'NEW PASSWORD AT LEAST 30 CHARACTERS LONG';
   ```

   Or to change another user's password:

   ```sql
   SET PASSWORD FOR 'another_user' = 'NEW PASSWORD AT LEAST 30 CHARACTERS LONG';
   ```

3. When changing the `th_admin` password you will need to [update the app's environment variable]
   `DATABASE_URL` to use the new password. If changing the `activedata` or `redash` user's
   passwords, the owners of those services will need to be notified.

<!-- prettier-ignore -->
!!! note
    Whilst the RDS "master account" password can be changed via the AWS console, this can
    only be performed by an admin of the `moz-devservices` AWS account for stage/prod, so
    it's easier to change the password using MySQL commands.

[according to the mysql documentation]: https://dev.mysql.com/doc/refman/5.7/en/set-password.html
[update the app's environment variable]: #environment-variables

### Other changes

The RDS instances are configured using [Terraform] and [this configuration file][terraform-config],
so the IAM permissions [have been set][iam-config] to be very strict (particularly for stage/prod)
to prevent the config from drifting out of sync with that in the `devservices-aws` repository.

To request disk space increases, MySQL configuration changes (via [Parameter Groups]), or MySQL
version upgrades, file a [Treeherder infrastructure bug] and needinfo `:dividehex`.

[terraform]: https://www.terraform.io/
[terraform-config]: https://github.com/mozilla-platform-ops/devservices-aws/blob/master/treeherder/rds.tf
[iam-config]: https://github.com/mozilla-platform-ops/devservices-aws/blob/master/treeherder/iam.tf
[parameter groups]: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithParamGroups.html
