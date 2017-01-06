Administrating Treeherder
=========================

Direct database access
----------------------

For cases where the REST API just isn't enough, a 3rd party
application might want to connect directly to the Treeherder
database (or a copy of it). To support these cases, you
will probably want to create a specific user for each application
who can access publically available information in a read-only
manner (omitting sensitive data like session tokens).

The following SQL should be sufficient to generate such a user
as of November 2016 (obviously you should replace `myuser` and
`mysecurepassword`):

.. code-block:: sql

    CREATE USER 'myuser' IDENTIFIED BY 'mysecurepassword';
    GRANT SELECT (id, username, email) ON treeherder.auth_user to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.bug_job_map to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.bugscache to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.build_platform to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.classified_failure to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.commit to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.exclusion_profile to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.exclusion_profile_exclusions to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.failure_classification to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.failure_line to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.failure_match to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.job to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.job_detail to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.job_duration to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.job_exclusion to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.job_group to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.job_log to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.job_note to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.job_type to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.machine to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.machine_platform to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.matcher to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.option to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.option_collection to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.performance_alert to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.performance_alert_summary to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.performance_bug_template to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.performance_datum to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.performance_framework to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.performance_signature to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.push to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.product to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.reference_data_signatures to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.repository to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.repository_group to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.runnable_job to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.text_log_error to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.text_log_step to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.text_log_summary to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.text_log_summary_line to 'myuser' REQUIRE SSL;
    GRANT SELECT ON treeherder.user_exclusion_profile to 'myuser' REQUIRE SSL;

If new tables are added, you can generate a new set of grant
statements using the following SQL:

.. code-block:: sql

    SELECT CONCAT('GRANT SELECT ON ', table_schema, '.', table_name, ' to ''user'' REQUIRE SSL;') AS grant_stmt
    FROM information_schema.TABLES
    WHERE table_schema = 'treeherder'
    AND table_name NOT REGEXP 'django_|auth_|credentials|corsheaders_|task_set_meta';
