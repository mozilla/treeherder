from treeherder.etl import buildbot
from treeherder.etl.common import (get_revision_hash,
                                   get_job_guid)
import drest

class TreeherderBuildapiAdapter(object):
    """docstring for BuilApiConsumer"""

    def process_pending_jobs():
        """
        pulls pending jobs from buildapi, applies a transformation
        and post it to the restful api
        """
        data = self.extract(settings.BUILDAPI_PENDING_URL)
        jobs = self.transform_pending_jobs(data)
        self.load(jobs)

    def process_running_jobs():
        """
        pulls running jobs from buildapi, applies a transformation
        and post it to the restful api
        """
        data = self.extract(settings.BUILDAPI_RUNNING_URL)
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
        jobs = []
        for branch, revisions in data['pending']:
            for rev, jobs in revisions:
                for job in jobs:
                    treeherder_data = {
                        'sources': {},
                        #Include branch so revision hash with the same revision is still
                        #unique across branches
                        'revision_hash': get_revision_hash(
                            [rev, branch]
                        ),
                    }
                    treeherder_data['sources'].append({
                        'repository': branch,
                        'revision': revision,
                    })

                    platform_info = buildbot.extract_platform_info(job['buildername'])

                    job = {
                        #This assumes the 0 element in request_ids is the id for the
                        #job which is not always true if there are coalesced jobs. This will need
                        #to be updated when https://bugzilla.mozilla.org/show_bug.cgi?id=862633
                        #is resolved.
                        'job_guid': get_job_guid(job['request_ids'][0], job['submitted_at']),
                        'name': buildbot.get_test_name(job['buildername']),
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

                    jobs.append(JobData(treeherder_data))
        return jobs

    def transform_running_jobs(self, data):
        """
        TODO: write a transform method for runnign jobs. the output should have a shape similar
        to transform_pending_jobs. Theoretically the only change should be the state value. 
        """
        pass

    def load(self, jobs):
        """
        TODO: once we have a restful api set up, use drest to send post request with the
        output of a transform function
        """
        pass
