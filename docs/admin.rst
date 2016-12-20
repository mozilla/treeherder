Administrating Treeherder
=========================

Changing the database models / tables
-------------------------------------

Most table-level modifications can be achieved by simply modifying
the appropriate Treeherder model classes and generating Django
schema migrations. However, there are some MySQL-specific gotchas
which apply when performing these operations on larger tables (i.e.
those with millions of rows or more).

* Django's schema migrations are often rather inefficient for the
  case where you are modifying multiple columns on a table at the
  same time (it will generate as many alter table statements as
  there are changes, when they could all be consolidated into one)
* Altering a column with a foreign key relationship (i.e. changing
  its type or adding/removing a null constraint) will cause MySQL
  to re-check the validity of that relation for every row, which
  can be quite expensive.
* `It does not seem to be possible <https://dev.mysql.com/doc/refman/5.6/en/innodb-create-index-limitations.html>`_ to add or alter a table column
  while additional rows are being added to the table without
  creating duplicates (which will then cause the whole operation
  to fail due to integrity errors)

For this reason, it is recommended that you bypass using Django
migrations and follow this procedure when modifying any large table:

* Generate the SQL in a vagrant instance for the schema changes
  you want to make (`./manage.py sqlmigrate model <name of migration>`
  will print this out to the console) and modify if needed (i.e.
  consolidating `ALTER TABLE` statements). For auditing purposes,
  please post this SQL to an attachment on the bug (it may also
  be a good idea to have another Treeherder dev look it over).
* Temporarily turn off job ingestion (you can do this by changing
  the number of dynos devoted to job ingestion in Heroku's dashboard).
  Ideally it would be best to do this in a period of slightly lower activity.
* Open a SQL session, `SET FOREIGN_KEY_CHECKS=0;` (this is a
  session-specific option, so no need to worry about resetting it
  later), then apply your changes.
* When the SQL is fully applied, manually generate an entry in the
  django_migrations table as follows: `insert into django_migrations
  (app, name, applied) values (<app>, <migration name>,
  <date>)`. Select a few rows from the table to see the
  expected format. For date, you can use the 'YYYY-MM-DD' format.
* Re-enable job ingestion.
* After this is done, you should be able to actually deploy your
  code change to Treeherder.

As an alternative to disabling job ingestion (which can be rather
intrusive), it is sometimes possible to perform a schema change on
a *copy* of your table, import the data into it, then swap the
tables.

For example:

.. code-block:: sql

    CREATE table performance_datum_copy LIKE performance_datum;
    <schema changes on performance_datum_copy>
    INSERT INTO performance_datum_copy SELECT * FROM performance_datum;
    SET @max_perf_id = (select max(id) FROM performance_datum_copy);
    INSERT INTO performance_datum_copy SELECT * FROM performance_datum
      WHERE id>@max_perf_id; RENAME TABLE performance_datum TO
      performance_datum_old, performance_datum_copy TO
      performance_datum;
    DROP TABLE performance_datum_old;

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
    GRANT SELECT ON treeherder.datasource to 'myuser' REQUIRE SSL;
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
