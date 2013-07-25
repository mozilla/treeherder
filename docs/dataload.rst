Loading buildbot data
=====================

There are 2 sources of data (for now) for treeherder: buildapi and pulse.
Here are the steps needed to load data coming from both the sources.

Buildapi
--------
There are 2 celery tasks available in treeherder to fetch data from buildapi:

* fetch-buildapi-pending
* fetch-buildapi-running

You can setup those 2 tasks in the django admin interface at /admin/djcelery/periodictask/add/.

The information needed are:

* name: just a description of the task
* task(registered): choose the task you want to setup up as periodic
* enabled: true

In the schedule section you can choose between a simple interval and a crontab-like definition.
Choose the one that best suits your needs.

In the arguments section, insert the url of the buildapi service that you want to fetch:

* "https://secure.pub.build.mozilla.org/builddata/buildjson/builds-pending.js" for pending
* "https://secure.pub.build.mozilla.org/builddata/buildjson/builds-running.js" for running

You can now save and exit. Based on the interval/crontab that you set up, your new periodic task will be executed!
