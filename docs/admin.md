Administrating Treeherder
=========================

Direct database access
----------------------

For cases where the REST API just isn't enough, a 3rd-party
application might want to connect directly to the Treeherder
database (or a copy of it). To support these cases, you
will probably want to create a specific user for each application
who can access publicly available information in a read-only
manner (omitting sensitive data like session tokens).

The following SQL should be sufficient to generate such a user
(obviously you should replace `myuser` and `mysecurepassword`):

```sql
CREATE USER 'myuser' IDENTIFIED BY 'mysecurepassword' REQUIRE SSL;

-- Tables where we want to allow only partial access.
-- Whilst `password` is not used (and randomly generated), it's still safer to exclude it.
GRANT SELECT (id, username, email) ON treeherder.auth_user to 'myuser';

-- Tables containing no sensitive data.
GRANT SELECT ON treeherder.bug_job_map to 'myuser';
GRANT SELECT ON treeherder.bugscache to 'myuser';
GRANT SELECT ON treeherder.build_platform to 'myuser';
GRANT SELECT ON treeherder.classified_failure to 'myuser';
GRANT SELECT ON treeherder.commit to 'myuser';
GRANT SELECT ON treeherder.failure_classification to 'myuser';
GRANT SELECT ON treeherder.failure_line to 'myuser';
GRANT SELECT ON treeherder.failure_match to 'myuser';
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
GRANT SELECT ON treeherder.matcher to 'myuser';
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
GRANT SELECT ON treeherder.runnable_job to 'myuser';
GRANT SELECT ON treeherder.seta_jobpriority to 'myuser';
GRANT SELECT ON treeherder.taskcluster_metadata to 'myuser';
GRANT SELECT ON treeherder.text_log_error to 'myuser';
GRANT SELECT ON treeherder.text_log_error_match to 'myuser';
GRANT SELECT ON treeherder.text_log_error_metadata to 'myuser';
GRANT SELECT ON treeherder.text_log_step to 'myuser';
```

If new tables are added, you can generate a new set of grant
statements using the following SQL:

```sql
SELECT CONCAT('GRANT SELECT ON ', table_schema, '.', table_name, ' to ''myuser'';') AS grant_stmt
FROM information_schema.TABLES
WHERE table_schema = 'treeherder'
AND table_name NOT REGEXP 'django_|auth_|credentials';
```
