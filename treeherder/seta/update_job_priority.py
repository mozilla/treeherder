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

from treeherder.seta.common import (db_map,
                                    unique_key)
from treeherder.seta.models import (DEFAULT_LOW_PRIORITY,
                                    DEFAULT_TIMEOUT,
                                    JobPriority)
from treeherder.seta.runnable_jobs import RunnableJobs

LOG = logging.getLogger(__name__)


class ManageJobPriorityTable():
    ''''Updates the seta_jobpriority table with information from new jobs'''
    def __init__(self):
        self.runnable_jobs = RunnableJobs()
        self.data = None

    def _unique_key(self, job):
        """Return a key to query our uniqueness mapping system.

        This makes sure that we use a consistent key between our code and selecting jobs from the
        table.
        """
        return unique_key(testtype=str(job['testtype']),
                          buildtype=str(job['platform_option']),
                          platform=str(job['platform']))

    def sanitized_data(self, runnable_jobs_data):
        """We receive data from runnable jobs api and return the sanitized data that meets our needs.

        This is a loop to remove duplicates (including buildsystem -> * transformations if needed)
        By doing this, it allows us to have a single database query

        It returns sanitized_list which will contain a subset which excludes:
        * jobs that don't specify the platform
        * jobs that don't specify the testtype
        * if the job appears again, we replace build_system_type with '*'
        """
        map = {}
        sanitized_list = []
        if not runnable_jobs_data:
            return sanitized_list

        for job in runnable_jobs_data['results']:
            # XXX: Once this code moves to TH, the database models will have foreign keys
            #      to other tables. Specifically platform and platform_option
            if not self.valid_platform(job['platform']):
                continue

            testtype = self.parse_testtype(
                build_system_type=job['build_system_type'],
                job_type_name=job['job_type_name'],
                platform_option=job['platform_option'],
                refdata=job['ref_data_name'])

            if not testtype:
                continue

            # NOTE: This is *all* the data we need from the runnable API
            new_job = {
                'build_system_type': job['build_system_type'],  # e.g. {buildbot,taskcluster,*}
                'platform': job['platform'],  # e.g. windows8-64
                'platform_option': job['platform_option'],  # e.g. {opt,debug}
                'testtype': testtype,  # e.g. web-platform-tests-1
            }
            key = self._unique_key(new_job)

            # Let's build a map of all the jobs and if duplicated change the build_system_type to *
            if key not in map:
                map[key] = job['build_system_type']
                sanitized_list.append(new_job)

            elif new_job['build_system_type'] != map[key]:
                previous_job = copy.deepcopy(new_job)
                previous_job['build_system_type'] = map[key]
                previous_index = sanitized_list.index(previous_job)
                # This will make so we *replace* the previous build system type with '*'
                # This also guarantees that we don't have duplicates
                sanitized_list[previous_index]['build_system_type'] = '*'

        return sanitized_list

    def query_sanitized_data(self, repo_name='mozilla-inbound'):
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
        runnable_jobs = self.runnable_jobs.query_runnable_jobs(repo_name)
        return self.sanitized_data(runnable_jobs)

    def update_job_priority_table(self):
        """Use it to update the job priority table with data from the runnable api."""
        # XXX: We are assuming that the jobs accross 'mozilla-inbound', 'autoland' and 'fx-team'
        #      are equivalent. This could cause issues in the future
        data = self.query_sanitized_data(repo_name='mozilla-inbound')

        if data:
            self._update_table(data)
            self.data = data
        else:
            LOG.warning('We received an empty data set')
            return

    def parse_testtype(self, build_system_type, job_type_name, platform_option, refdata):
        # TODO: figure out how to ignore build, lint, etc. jobs
        if build_system_type == 'buildbot':
            return refdata.split(' ')[-1]
        else:
            # e.g. "desktop-test-linux64/opt-reftest-8",
            # taskcluster test types
            testtype = job_type_name
            if testtype.startswith('[funsize'):
                return None

            testtype = testtype.split('/opt-')[-1]
            testtype = testtype.split('/debug-')[-1]

            # this is plain-reftests for android
            testtype = testtype.replace('plain-', '')

            # SETA/Ouija do not care about builds, or other jobs like lint, etc.
            # Bug 1318659 - for how mozci could help here
            testtype = testtype.replace(' Opt', 'build')
            testtype = testtype.replace(' Debug', 'build')
            testtype = testtype.replace(' Dbg', 'build')
            testtype = testtype.replace(' (opt)', 'build')
            testtype = testtype.replace(' PGO Opt', 'build')
            testtype = testtype.replace(' Valgrind Opt', 'build')
            testtype = testtype.replace(' Artifact Opt', 'build')
            testtype = testtype.replace(' (debug)', 'build')

            testtype = testtype.strip(' ')

            # TODO: these changes should have bugs on file to fix the names
            testtype = testtype.replace('browser-chrome-e10s', 'e10s-browser-chrome')
            testtype = testtype.replace('devtools-chrome-e10s', 'e10s-devtools-chrome')
            testtype = testtype.replace('[TC] Android 4.3 API15+ ', '')

            # TODO: fix this in updatedb.py
            testtype = testtype.replace('webgl-', 'gl-')

            return testtype

    def valid_platform(self, platform):
        # TODO: This is very hardcoded and prone to fall out of date
        # We only care about in-tree scheduled tests and ignore out of band system
        # like autophone.
        return platform not in [
            'android-4-2-armv7-api15',
            'android-4-4-armv7-api15',
            'android-5-0-armv8-api15',
            'android-5-1-armv7-api15',
            'android-6-0-armv8-api15',
            'b2g-device-image',
            'mulet-linux64',
            'osx-10-7',
            'osx-10-9',
            'osx-10-11',
            'other',
            'taskcluster-images',
            'windows7-64'
            'windows8-32',
            'Win 6.3.9600 x86_64',
        ]

    def _two_weeks_from_now(self):
        return datetime.datetime.now() + datetime.timedelta(days=14)

    def _initialize_values(self):
        LOG.info('Fetch all rows from the job priority table.')
        # Get all rows of job priorities
        db_data = JobPriority.objects.all()
        map = db_map(db_data)
        if db_data:
            # For 2 weeks the job will be considered high value (priority=1)
            expiration_date = self._two_weeks_from_now()
            return db_data, map, 1, 0, expiration_date
        else:
            # When the table is empty it means that we're starting the system for the first time
            # and we're going to use a different set of default values
            # All job priorities will be marked as low value jobs
            # If information to determine job failures is available, the jobs will quickly be turned
            # into high value jobs.
            return db_data, map, DEFAULT_LOW_PRIORITY, DEFAULT_TIMEOUT, None

    def joblist(self):
        if not self.data:
            self.update_job_priority_table()
        return self.data

    def _update_table(self, data):
        """Add new jobs to the priority table and update the build system if required.
        data - it is a list of dictionaries that describe a job type

        returns the number of new, failed and updated jobs
        """
        db_data, map, priority, timeout, expiration_date = self._initialize_values()

        total_jobs = len(data)
        new_jobs, failed_changes, updated_jobs = 0, 0, 0
        # Loop through sanitized jobs, add new jobs and update the build system if needed
        for job in data:
            key = self._unique_key(job)
            if key in map:
                # We already know about this job, we might need to update the build system
                # We're seeing the job again with another build system (e.g. buildbot vs
                # taskcluster). We need to change it to '*'
                if map[key]['build_system_type'] != job["build_system_type"]:
                    db_job = JobPriority.objects.get(pk=map[key]['pk'])
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
