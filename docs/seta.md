# SETA

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

In order to find open bugs for SETA visit list of [SETA bugs].

[seta bugs]: https://bugzilla.mozilla.org/buglist.cgi?product=Tree%20Management&component=Treeherder%3A%20SETA&resolution=---

## API

- `/api/project/{project}/seta/job-priorities/`
  - This is the API that consumers like the Gecko decision task will use
  - Currently only available for `autoland` and `try`

## Local set up

- Follow the steps at [Starting a local Treeherder instance].
  - Basically `docker-compose up`. This will initialize SETA's data

- Try out the various APIs:
  - <http://localhost:8000/api/project/autoland/seta/job-priorities/>

[starting a local treeherder instance]: installation.md#starting-a-local-treeherder-instance

## Local development

If you have ingested invalid `preseed.json` data you can clear like this:

```bash
./manage.py initialize_seta --clear-job-priority-table
```

If you want to validate `preseed.json` you can do so like this:

```bash
./manage.py load_preseed --validate
```

## Maintenance

Sometimes the default behaviour of SETA is not adequate (e.g. new jobs noticed get a 2 week expiration date & a high priority) when adding new platforms (e.g. stylo).
Instead of investing more on accommodating for various scenarios we’ve decided to document how to make changes in the DB when we have to.

If you want to inspect the priorities for various jobs and platforms you can query the JobPriority table from reDash.
Use this query as a starting point:

<https://sql.telemetry.mozilla.org/queries/14771/source#table>

### Steps for adjusting jobs

To connect to Treeherder you need Heroku permissions & the Heroku CLI installed. Then run:

```bash
heroku run --app treeherder-prod -- bash
```

Sometimes, before you can adjust priorities of the jobs, you need to make sure they make it into the JobPriority table.
In order to do so we need to update the job priority table from the shell:

  Open the Python shell using `./manage.py shell`, then enter:

  ```python
  from treeherder.seta.update_job_priority import update_job_priority_table
  update_job_priority_table()
  ```

  If you want to remove the 2 week grace period and make the job low priority (priority=5) do something similar to this:

  ```python
  from treeherder.seta.models import JobPriority;
  # Inspect the jobs you want to change
  # Change the values appropriately
  JobPriority.objects.filter(platform="windows7-32-stylo", priority=1)
  JobPriority.objects.filter(platform="windows7-32-stylo", expiration_date__isnull=False)
  # Once satisfied
  JobPriority.objects.filter(platform="windows7-32-stylo", priority=1).update(priority=5);
  JobPriority.objects.filter(platform="windows7-32-stylo", expiration_date__isnull=False).update(expiration_date=None)
  ```
