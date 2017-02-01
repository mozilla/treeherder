Loading buildbot data
=====================

In order to start ingesting data, you need to turn on a celery worker with a '-B' option.
In this way the worker can run some scheduled tasks that are defined in treeherder.config.settings.CELERYBEAT_SCHEDULE.
Here is a brief description of what each periodic task will do for you:

*fetch-push-logs*
  Retrieves and store all the latest pushes (a.k.a. resultsets) from the available repositories.
  You need to have this running before you can start ingestiong job data. No pushes, no jobs.

*fetch-buildapi-pending*
  Retrieves and store buildbot pending jobs using `RelEng buildapi`_ service

*fetch-buildapi-running*
  Same as before, but for running jobs

*fetch-buildapi-build4h*
  Same as before, but it collects all the jobs completed in the last 4 hours.

The following is a data flow diagram which can help to understand better how these tasks are used by treeherder

.. image:: https://cacoo.com/diagrams/870thliGfT89pLZc-B5E80.png
   :width: 800px

.. _RelEng buildapi: https://wiki.mozilla.org/ReleaseEngineering/BuildAPI
.. _dataflow diagram: https://cacoo.com/diagrams/870thliGfT89pLZc
