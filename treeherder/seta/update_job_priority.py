'''This module is used to add new jobs to the job priority table.

This will query the Treeherder runnable api based on the latest task ID from
mozilla-inbound's TaskCluster index.

Known bug:
 * Only considering mozilla-inbound makes SETA act similarly in all repositories where it is
   active. Right now, this works for integration repositories since they tend to have
   the same set of jobs. Unfortunately, this is less than ideal if we want to make this
   work for project repositories.
'''
import copy
import datetime
import json
import logging
import os
import time

import requests
from redo import retry

from treeherder.config.settings import (SETA_HIGH_VALUE_PRIORITY,
                                        SETA_HIGH_VALUE_TIMEOUT,
                                        SETA_LOW_VALUE_PRIORITY,
                                        SETA_LOW_VALUE_TIMEOUT)
from treeherder.etl.seta import (parse_testtype,
                                 valid_platform)
from treeherder.seta.common import (job_priority_index,
                                    unique_key)
from treeherder.seta.models import JobPriority
from treeherder.seta.runnable_jobs import RunnableJobsClient

LOG = logging.getLogger(__name__)


def update_job_priority_table():
    """Use it to update the job priority table with data from the runnable api."""
    # XXX: We are assuming that the jobs accross 'mozilla-inbound', 'autoland' and 'fx-team'
    #      are equivalent. This could cause issues in the future
    data = query_sanitized_data(repo_name='mozilla-inbound')
    if data:
        return _update_table(data)
    else:
        # XXX: Should we do this differently?
        LOG.warning('We received an empty data set')
        return


def _unique_key(job):
    """Return a key to query our uniqueness mapping system.

    This makes sure that we use a consistent key between our code and selecting jobs from the
    table.
    """
    return unique_key(testtype=str(job['testtype']),
                      buildtype=str(job['platform_option']),
                      platform=str(job['platform']))

def _sanitize_data(runnable_jobs_data):
    """We receive data from runnable jobs api and return the sanitized data that meets our needs.

    This is a loop to remove duplicates (including buildsystem -> * transformations if needed)
    By doing this, it allows us to have a single database query

    It returns sanitized_list which will contain a subset which excludes:
    * jobs that don't specify the platform
    * jobs that don't specify the testtype
    * if the job appears again, we replace build_system_type with '*'. By doing so, if a job appears
      under both 'buildbot' and 'taskcluster', its build_system_type will be '*'
    """
    job_build_system_type = {}
    sanitized_list = []
    for job in runnable_jobs_data['results']:
        if not valid_platform(job['platform']):
            LOG.info('Invalid platform {}'.format(job['platform']))
            continue

        testtype = parse_testtype(
            build_system_type=job['build_system_type'],
            job_type_name=job['job_type_name'],
            platform_option=job['platform_option'],
            ref_data_name=job['ref_data_name']
        )

        if not testtype:
            continue

        # NOTE: This is *all* the data we need from the runnable API
        new_job = {
            'build_system_type': job['build_system_type'],  # e.g. {buildbot,taskcluster,*}
            'platform': job['platform'],  # e.g. windows8-64
            'platform_option': job['platform_option'],  # e.g. {opt,debug}
            'testtype': testtype,  # e.g. web-platform-tests-1
        }
        key = _unique_key(new_job)

        # Let's build a map of all the jobs and if duplicated change the build_system_type to *
        if key not in job_build_system_type:
            job_build_system_type[key] = job['build_system_type']
            sanitized_list.append(new_job)
        elif new_job['build_system_type'] != job_build_system_type[key]:
            new_job['build_system_type'] = job_build_system_type[key]
            # This will *replace* the previous build system type with '*'
            # This guarantees that we don't have duplicates
            sanitized_list[sanitized_list.index(new_job)]['build_system_type'] = '*'

    return sanitized_list

def query_sanitized_data(repo_name='mozilla-inbound'):
    """Return sanitized jobs data based on runnable api. None if failed to obtain or no new data.

     We need to find the latest gecko decision task ID (by querying the index [1][2])
     in order to know which task ID to pass to the runnable api [3].

     It stores the minimal sanitized data from runnable apis under ~/.mozilla/seta/<task_id>.json

     [1] https://index.taskcluster.net/v1/task/gecko.v2.%s.latest.firefox.decision/
     [2] Index's data structure:
      {
        "namespace": "gecko.v2.mozilla-inbound.latest.firefox.decision",
        "taskId": "Dh9ZvFk5QCSprJ877cgUmw",
        "rank": 0,
        "data": {},
        "expires": "2017-10-06T18:30:18.428Z"
      }
     [3] https://treeherder.mozilla.org/api/project/mozilla-inbound/runnable_jobs/?decision_task_id=Pp7ZxoH0SKyU6wnhX_Fp0g&format=json  # flake8: noqa
    """
    runnable_jobs = RunnableJobsClient().query_runnable_jobs(repo_name)
    return _sanitize_data(runnable_jobs)

def _two_weeks_from_now():
    return datetime.datetime.now() + datetime.timedelta(days=14)

def _initialize_values():
    LOG.info('Fetch all rows from the job priority table.')
    # Get all rows of job priorities
    jp_index = job_priority_index(JobPriority.objects.all())
    if jp_index:
        # For 2 weeks the job will be considered high value (priority=1)
        return jp_index, SETA_HIGH_VALUE_PRIORITY, SETA_HIGH_VALUE_TIMEOUT, _two_weeks_from_now()
    else:
        # When the table is empty it means that we're starting the system for the first time
        # and we're going to use a different set of default values
        # All job priorities will be marked as low value jobs
        # If information to determine job failures is available, the jobs will quickly be turned
        # into high value jobs.
        return jp_index, SETA_LOW_VALUE_PRIORITY, SETA_LOW_VALUE_TIMEOUT, None

def _update_table(data):
    """Add new jobs to the priority table and update the build system if required.
    data - it is a list of dictionaries that describe a job type

    returns the number of new, failed and updated jobs
    """
    jp_index, priority, timeout, expiration_date = _initialize_values()

    total_jobs = len(data)
    new_jobs, failed_changes, updated_jobs = 0, 0, 0
    # Loop through sanitized jobs, add new jobs and update the build system if needed
    for job in data:
        key = _unique_key(job)
        if key in jp_index:
            # We already know about this job, we might need to update the build system
            # We're seeing the job again with another build system (e.g. buildbot vs
            # taskcluster). We need to change it to '*'
            if jp_index[key]['build_system_type'] != '*' and jp_index[key]['build_system_type'] != job["build_system_type"]:
                db_job = JobPriority.objects.get(pk=jp_index[key]['pk'])
                db_job.buildsystem = '*'
                db_job.save()

                LOG.info('Updated {}/{} from {} to {}'.format(
                   db_job.testtype, db_job.buildtype, job['build_system_type'], db_job.buildsystem
                ))
                updated_jobs += 1

        else:
            # We have a new job from runnablejobs to add to our master list
            try:
                jobpriority = JobPriority(
                    testtype=str(job["testtype"]),
                    buildtype=str(job["platform_option"]),
                    platform=str(job["platform"]),
                    priority=priority,
                    timeout=timeout,
                    expiration_date=expiration_date,
                    buildsystem=job["build_system_type"]
                )
                jobpriority.save()
                LOG.info('New job was found ({},{},{},{})'.format(
                    job['testtype'], job['platform_option'], job['platform'],
                    job["build_system_type"]))
                new_jobs += 1
            except Exception as error:
                LOG.warning(str(error))
                failed_changes += 1

    LOG.info('We have {} new jobs and {} updated jobs out of {} total jobs '
                      'processed.'.format(new_jobs, updated_jobs, total_jobs))

    if failed_changes != 0:
        LOG.warning('We have failed {} changes out of {} total jobs processed.'.format(
            failed_changes, total_jobs
        ))

    return new_jobs, failed_changes, updated_jobs
