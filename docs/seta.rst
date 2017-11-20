SETA
====

SETA finds the minimum set of jobs to run in order to catch all failures that our automation has found in the recent past on Firefox development repositories.
There's one main API that SETA offers consumers (e.g. the Gecko decision task) in order to show which jobs are consider low value
(less likely to catch a regression). After a certain number of calls, the API will return all jobs that need to be run.

SETA creates job priorities for all jobs found in the runnable-jobs API for that repository.
Initially all jobs will be treated as low value, however, once we run the test to analyze past
failures we will mark certain jobs as high value (priority=1).

Also note that jobs from different platforms (linux64 vs win7) or different CI systems (Buildbot vs TaskCluster)
will be treated the same (use the same job priority). In other words, a job priority can represent a multiple
number of jobs.

Jobs that appear on Treeherder for the first time will be treated as a job with high priority for a couple of
weeks since we don't have historical data to determine how likely they're to catch a code regression.

In order to find open bugs for SETA visit list of `SETA bugs <https://bugzilla.mozilla.org/buglist.cgi?query_format=specific&order=relevance%20desc&bug_status=__open__&product=Tree%20Management&content=SETA&comments=0&list_id=13358642>`_.

APIs
----
* /api/project/{project}/seta/{version}/job-priorities/

  * This is the API that consumers like the Gecko decision task will use

* /api/project/{project}/seta/{version}/job-types/

  * This API shows which jobs are defined for each project

* /api/seta/{version}/failures-fixed-by-commit/

  * This API shows job failures that have been annotated with "fixed by commit"

Local set up
============
After you set up Treeherder, ssh (3 different tabs) into the provisioned VM and follow these steps:

1st tab
-------
.. code-block:: bash

   ./manage.py runserver

2nd tab
-------
.. code-block:: bash

   yarn start:local

3rd tab
-------
.. code-block:: bash

   ./manage.py initialize_seta

Try out the various APIs
------------------------

* http://localhost:8000/api/project/mozilla-inbound/seta/v1/job-priorities/?build_system_type=buildbot
* http://localhost:8000/api/project/mozilla-inbound/seta/v1/job-priorities/?build_system_type=taskcluster
* http://localhost:8000/api/project/mozilla-inbound/seta/v1/job-types/
* http://localhost:8000/api/seta/v1/failures-fixed-by-commit/ 

  * This one won't work until https://bugzilla.mozilla.org/show_bug.cgi?id=1389123 is fixed

Maintenance
===========

Sometimes the default behaviour of SETA is not adequate (e.g. new jobs noticed get a 2 week expiration date & a high priority)
when adding new platforms (e.g. stylo).
Instead of investing more on accomodating for various scenarios we’ve decided to document how to make changes in the DB when we have to.

If you want to inspect the priorities for various jobs and platforms you can query the JobPriority table from reDash:
Use this a starting query: https://sql.telemetry.mozilla.org/queries/14771/source#table

Steps for adjusting jobs
------------------------
To connect to Treeherder you need Heroku permissions. Run this from a treeherder checkout:

.. code-block:: bash

   heroku run --app treeherder-prod -- bash

Sometimes, before you can adjust priorities of the jobs, you need to make sure they make it into the JobPriority table.
In order to do so we need to:

* Make sure the scheduling changes have made it into mozilla-inbound

  * SETA uses mozilla-inbound as a reference for jobs for all trunk trees
* Make sure the job shows up on the runnable jobs table

  * You can check the `API <https://treeherder.mozilla.org/api/project/mozilla-inbound/runnable_jobs/>`_, however, it can time out
  * You can update the table with ``export TREEHERDER_DEBUG=True && ./manage.py update_runnable_jobs`` (it will take several minutes)
* Update the job priority table from the shell:

.. code-block:: bash

  from treeherder.seta.update_job_priority import update_job_priority_table
  update_job_priority_table()
  

If you want to remove the 2 week grace period and make the job low priority (priority=5) do somthing similar to this:

.. code-block:: bash

  ./manage.py shell
  from treeherder.seta.models import JobPriority;
  # Inspect the jobs you want to change
  # Change the values appropriately
  JobPriority.objects.filter(platform="windows7-32-stylo", priority=1)
  JobPriority.objects.filter(platform="windows7-32-stylo", expiration_date__isnull=False)
  # Once satisfied
  JobPriority.objects.filter(platform="windows7-32-stylo", priority=1).update(priority=5);
  JobPriority.objects.filter(platform="windows7-32-stylo", expiration_date__isnull=False).update(expiration_date=None)
