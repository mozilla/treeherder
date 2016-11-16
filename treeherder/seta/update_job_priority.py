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

from treeherder.seta.common import *
from treeherder.seta.models import JobPriority

HEADERS = {
    'Accept': 'application/json',
    'User-Agent': 'treeherder-seta',
}
LOG = logging.getLogger(__name__)
TREEHERDER_HOST = 'https://treeherder.mozilla.org'
RUNNABLE_API = TREEHERDER_HOST + '/api/project/{0}/runnable_jobs/?decision_task_id={1}&format=json'


class ManageJobPriorityTable():
    ''''Updates the seta_jobpriority table with information from new jobs'''

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
        * jobs that don't specify the build_platform
        * jobs that don't specify the testtype
        * if the job appears again, we replace build_system_type with '*'
        """
        map = {}
        sanitized_list = []
        if not runnable_jobs_data:
            return sanitized_list

        for job in runnable_jobs_data['results']:
            # XXX: Once this code moves to TH, the database models will have foreign keys
            #      to other tables. Specifically platform/build_platform and platform_option
            if not self.valid_platform(job['build_platform']):
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
                'platform': job['build_platform'],  # e.g. windows8-64
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

    def _query_latest_gecko_decision_task_id(self, repo_name):
        url = "https://index.taskcluster.net/v1/task/gecko.v2.%s.latest.firefox.decision/" % repo_name
        try:
            LOG.info('Fetching {}'.format(url))
            latest_task = retry(
                requests.get,
                args=(url, ),
                kwargs={'headers': {'accept-encoding': 'json'}, 'verify': True}
            ).json()
            task_id = latest_task['taskId']
            LOG.info('For {} we found the task id: {}'.format(repo_name, task_id))
        except Exception as error:
            # we will end this function if got exception here
            LOG.warning("The request for %s failed due to %s" % (url, error))
            return None

    def query_sanitized_data(self, repo_name='mozilla-inbound'):
        """Return sanitized jobs data based on runnable api. None if failed to obtain or no new data.

         We need to find the latest gecko decision task ID (by querying the index [1][2])
         in order to know which task ID to pass to the runnable api [3][4].

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
         [4] NOTE: I Skip some data that is not relevant to failures.py
         {
          meta: {
            count: 2317,
            offset: 0,
            repository: mozilla-inbound,
          },
          results: [
            {
              build_platform: windows8-64,
              build_system_type: buildbot,
              job_type_name: W3C Web Platform Tests,
              platform_option: debug,
              ref_data_name: Windows 8 64-bit mozilla-inbound debug test web-platform-tests-1,
            },
            {
                "build_platform": "linux64",
                "build_system_type": "taskcluster",
                "job_type_name": "desktop-test-linux64/opt-reftest-8",
                "platform": "linux64",
                "platform_option": "opt",
                "ref_data_name": "desktop-test-linux64/opt-reftest-8",
            },
        """
        task_id = self._query_latest_gecko_decision_task_id(repo_name)
        if not task_id:
            return None

        path = os.path.join(get_root_dir(), '%s.json' % task_id)

        # we do nothing if the timestamp of runablejobs.json is equal with the latest task
        # otherwise we download and update it
        if os.path.isfile(path):
            LOG.info("We have already processed the data from this task (%s)." % task_id)
            return None
        else:
            LOG.info("We're going to fetch new runnable jobs data.")
            # We never store the output of runnable api but the minimal data we need
            data = self.sanitized_data(self.query_runnable_jobs(repo_name=repo_name, task_id=task_id))

            if data:
                # Store the sanitized data to disk for inspection
                with open(path, 'w') as f:
                    json.dump(data, f, indent=2, sort_keys=True)

            return data

    def update_job_priority_table(self):
        """Use it to update the job priority table with data from the runnable api."""
        # XXX: We are assuming that the jobs accross 'mozilla-inbound', 'autoland' and 'fx-team'
        #      are equivalent. This could cause issues in the future
        data = self.query_sanitized_data(repo_name='mozilla-inbound')

        if data:
            self._update_job_priority_table(data)
        else:
            LOG.warning('We received an empty data set')
            return

    def query_runnable_jobs(self, task_id, repo_name='mozilla-inbound'):
        url = RUNNABLE_API.format(repo_name, task_id)
        try:
            data = retry(requests.get, args=(url, ), kwargs={'headers': HEADERS}).json()
            if data:
                # A lot of code components still rely on the file being on disk
                with open(get_runnable_jobs_path(), 'w') as f:
                    json.dump(data, f, indent=2, sort_keys=True)

            return data
        except Exception as e:
            LOG.warning("We failed to get runnablejobs via %s" % url)
            LOG.warning(str(e))
            return None

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
            testtype = testtype.replace('jittests-', 'jittest-')

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

    def _initialize_values(self):
        LOG.info('Fetch all rows from the job priority table.')
        # Get all rows of job priorities
        db_data = JobPriority.objects.all()
        map = {}
        if db_data:
            # For 2 weeks the job will be considered high value (priority=1)
            expiration_date = datetime.datetime.now() + datetime.timedelta(days=14)
            # Creating this data structure which reduces how many times we iterate through the DB rows
            for row in db_data:
                key = self._unique_key({
                    'testtype': row.testtype,
                    'platform_option': row.buildtype,
                    'platform': row.platform,
                })
                # This is guaranteed by a unique composite index for these 3 fields in models.py
                assert key not in map,\
                    '"{}" should be a unique row and that is unexpected.'.format(key)
                # (testtype, buildtype, platform)
                map[key] = {'pk': row.id, 'build_system_type': row.buildsystem}

            return db_data, map, 1, 0, expiration_date
        else:
            # When the table is empty it means that we're starting the system for the first time
            # and we're going to use a different set of default values
            # All job priorities will be marked as low value jobs
            # If information to determine job failures is available, the jobs will quickly be turned
            # into high value jobs.
            return db_data, map, 5, 5400, None

    def _update_job_priority_table(self, data):
        """Add new jobs to the priority table and update the build system if required."""
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
                    db_job = JobPriority.objects.get(map[key]['pk'])
                    db_job.buildsystem = '*'
                    db_job.save()

                    LOG.info('Updated {}/{} from {} to {}'.format(
                       job.testtype, job.buildtype, job['build_system_type'], db_job.buildsystem
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
