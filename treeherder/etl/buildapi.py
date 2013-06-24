import logging
import urllib2

import simplejson as json
from django.conf import settings

from . import buildbot
from .common import (get_revision_hash, get_job_guid,
                     JobData, TreeherderDataAdapter)


logger = logging.getLogger(__file__)


class TreeherderBuildapiAdapter(TreeherderDataAdapter):
    """
    Extract the pending and running jobs from buildapi,
    transform them in a treeherder-friendly format and
    load the transformed data to the objectstore restful api

    """

    def process_pending_jobs(self, buildapi_pending_url):
        """
        pulls pending jobs from buildapi, applies a transformation
        and post it to the restful api
        """
        data = self.extract(buildapi_pending_url)
        jobs = self.transform_pending_jobs(data)
        self.load(jobs)

    def process_running_jobs(self, buildapi_running_url):
        """
        pulls running jobs from buildapi, applies a transformation
        and post it to the restful api
        """
        data = self.extract(buildapi_running_url)
        jobs = self.transform_running_jobs(data)
        self.load(jobs)

    def extract(self, url):
        """
        Fetches a url pointing to a json file and return a dict
        representing its content.
        """
        response = urllib2.urlopen(url)
        if response.info().get('Content-Encoding') == 'gzip':
            buf = StringIO(response.read())
            f = gzip.GzipFile(fileobj=buf)
            return f.read()
        return json.loads(response.read())

    def transform_pending_jobs(self, data):
        """
        transform the buildapi structure into something we can ingest via
        our restful api
        """
        job_list = []
        for branch, revisions in data['pending'].items():
            for rev, jobs in revisions.items():
                for job in jobs:
                    treeherder_data = {
                        'sources': [],
                        #Include branch so revision hash with the same revision is still
                        #unique across branches
                        'revision_hash': get_revision_hash(
                            [rev, branch]
                        ),
                    }
                    treeherder_data['sources'].append({
                        'repository': branch,
                        'revision': rev,
                    })

                    platform_info = buildbot.extract_platform_info(job['buildername'])

                    job = {
                        'job_guid': get_job_guid(job['id'], job['submitted_at']),
                        'name': buildbot.extract_test_name(job['buildername']),
                        'state': 'pending',
                        'submit_timestamp': job['submitted_at'],
                        'build_platform': {
                            'os_name': platform_info['os'],
                            'platform': platform_info['os_platform'],
                            'architecture': platform_info['arch'],
                            'vm': platform_info['vm']
                        },
                        #where are we going to get this data from?
                        'machine_platform': {
                            'os_name': platform_info['os'],
                            'platform': platform_info['os_platform'],
                            'architecture': platform_info['arch'],
                            'vm': platform_info['vm']
                        },

                        'option_collection': {
                            # build_type contains an option name, eg. PGO
                            buildbot.extract_build_type(job['buildername']): True
                        },
                        'log_references': [{
                            'url': None,
                            #using the jobtype as a name for now, the name allows us
                            #to have different log types with their own processing
                            'name': buildbot.extract_job_type(job['buildername'])
                        }]
                    }
                    treeherder_data['job'] = job

                    job_list.append(JobData(treeherder_data))
        return job_list

    def transform_running_jobs(self, data):
        """
        transform the buildapi structure into something we can ingest via
        our restful api
        """
        job_list = []
        for branch, revisions in data['running'].items():
            for rev, jobs in revisions.items():
                for job in jobs:
                    treeherder_data = {
                        'sources': [],
                        #Include branch so revision hash with the same revision is still
                        #unique across branches
                        'revision_hash': get_revision_hash(
                            [rev, branch]
                        ),
                    }
                    treeherder_data['sources'].append({
                        'repository': branch,
                        'revision': rev,
                    })

                    platform_info = buildbot.extract_platform_info(job['buildername'])

                    job = {
                        'job_guid': get_job_guid(
                            job['request_ids'][0],
                            job['submitted_at']
                        ),
                        'name': buildbot.extract_test_name(job['buildername']),
                        'state': 'running',
                        'submit_timestamp': job['submitted_at'],
                        'build_platform': {
                            'os_name': platform_info['os'],
                            'platform': platform_info['os_platform'],
                            'architecture': platform_info['arch'],
                            'vm': platform_info['vm']
                        },
                        #where are we going to get this data from?
                        'machine_platform': {
                            'os_name': platform_info['os'],
                            'platform': platform_info['os_platform'],
                            'architecture': platform_info['arch'],
                            'vm': platform_info['vm']
                        },

                        'option_collection': {
                            # build_type contains an option name, eg. PGO
                            buildbot.extract_build_type(job['buildername']): True
                        },
                        'log_references': [{
                            'url': None,
                            #using the jobtype as a name for now, the name allows us
                            #to have different log types with their own processing
                            'name': buildbot.extract_job_type(job['buildername'])
                        }]
                    }

                    treeherder_data['job'] = job

                    job_list.append(JobData(treeherder_data))
        return job_list
