Loading buildbot data
=====================

In order to start ingesting data, you need to turn on a celery worker with a '-B' option.
In this way the worker can run some scheduled tasks that are loaded in the database with the init_master_db command.
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

*process-objects*
  As the name says, processes job objects from the objectstore to the jobs store.
  Once a job is processed, it becomes available in the restful interface for consumption.
  See the `dataflow diagram`_ for more info

Follows a data flow diagram which can help to understand better how these tasks are used by treeherder

.. image:: https://cacoo.com/diagrams/870thliGfT89pLZc-B5E80.png
   :width: 800px

.. _RelEng buildapi: https://wiki.mozilla.org/ReleaseEngineering/BuildAPI
.. _dataflow diagram: https://cacoo.com/diagrams/870thliGfT89pLZc
