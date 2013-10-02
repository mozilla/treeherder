Loading buildbot data
=====================

Buildapi
--------
This is the list of celery tasks in Treeherder for fetching data from buildapi:

* fetch-push-logs
* fetch-buildapi-pending
* fetch-buildapi-running
* fetch-buildapi-build4h

You can setup those tasks in the django admin interface at
``/admin/djcelery/periodictask/add/``.

For each task, set the following fields:

* name: just a description of the task
* task(registered): from the list above
* enabled: true

In the schedule section you can choose between a simple interval and a
crontab-like definition.  Choose the one that best suits your needs.

You can now save and exit. Once you start the celery task process, your tasks
will be run according to the interval you chose.
