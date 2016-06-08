import logging
import zlib

import simplejson as json
from django.forms import model_to_dict

from treeherder.etl.perf import load_perf_artifacts
from treeherder.model import utils
from treeherder.model.models import (Job,
                                     JobDetail,
                                     ReferenceDataSignatures)

from ..error_summary import is_helpful_search_term
from .base import TreeherderModelBase

logger = logging.getLogger(__name__)


class ArtifactsModel(TreeherderModelBase):

    """
    Represent the artifacts for a job repository

    """

    INDEXED_COLUMNS = {
        "job_artifact": {
            "id": "id",
            "job_id": "job_id",
            "name": "name",
            "type": "type"
        }
    }

    def execute(self, **kwargs):
        return utils.retry_execute(self.get_dhub(), logger, **kwargs)

    def get_job_artifact_references(self, job_id):
        """
        Return the job artifact references for the given ``job_id``.

        This is everything about the artifact, but not the artifact blob
        itself.
        """
        data = self.execute(
            proc="jobs.selects.get_job_artifact_references",
            placeholders=[job_id],
            debug_show=self.DEBUG,
        )
        return data

    def get_job_artifact_list(self, offset, limit, conditions=None):
        """
        Retrieve a list of job artifacts. The conditions parameter is a
        dict containing a set of conditions for each key. e.g.:
        {
            'job_id': set([('IN', (1, 2))])
        }
        """

        replace_str, placeholders = self._process_conditions(
            conditions, self.INDEXED_COLUMNS['job_artifact']
        )

        repl = [replace_str]

        proc = "jobs.selects.get_job_artifact"

        data = self.execute(
            proc=proc,
            replace=repl,
            placeholders=placeholders,
            limit=limit,
            offset=offset,
            debug_show=self.DEBUG,
        )
        for artifact in data:
            artifact["blob"] = zlib.decompress(artifact["blob"])

            if artifact["type"] == "json":
                artifact["blob"] = json.loads(artifact["blob"])

        return data

    def store_job_artifact(self, artifact_placeholders):
        """
        Store a list of job_artifacts given a list of placeholders
        """
        self.execute(
            proc='jobs.inserts.set_job_artifact',
            debug_show=self.DEBUG,
            placeholders=artifact_placeholders,
            executemany=True)

    def store_job_details(self, job, job_info_artifact):
        """
        Store the contents of the job info artifact
        in job details
        """
        job_details = json.loads(job_info_artifact['blob'])['job_details']
        for job_detail in job_details:
            job_detail_dict = {
                'title': job_detail.get('title'),
                'value': job_detail['value'],
                'url': job_detail.get('url')
            }
            max_field_length = JobDetail.MAX_FIELD_LENGTH
            for (k, v) in job_detail_dict.iteritems():
                if v is not None and len(v) > max_field_length:
                    logger.warning("Job detail '{}' for job_guid {} too long, "
                                   "truncating".format(
                                       v[:max_field_length],
                                       job.guid))
                    job_detail_dict[k] = v[:max_field_length]

            JobDetail.objects.get_or_create(
                job=job,
                defaults=job_detail_dict,
                **job_detail_dict)

    def store_performance_artifact(
            self, job_ids, performance_artifact_placeholders):
        """
        Store the performance data
        """

        # Retrieve list of job signatures associated with the jobs
        job_data = self.get_job_signatures_from_ids(job_ids)

        job_ref_data_signatures = set()
        map(
            lambda job_guid: job_ref_data_signatures.add(
                job_data[job_guid]['signature']
            ),
            job_data.keys()
        )

        for perf_data in performance_artifact_placeholders:
            job_guid = perf_data["job_guid"]
            ref_data_signature = job_data[job_guid]['signature']
            # At the moment there could be multiple signatures returned
            # by this, but let's just ignore that and take the first
            # if there are multiple (since the properties we care about should
            # be the same)
            ref_data = model_to_dict(ReferenceDataSignatures.objects.filter(
                signature=ref_data_signature,
                repository=self.project)[0])

            # adapt and load data into placeholder structures
            load_perf_artifacts(self.project, ref_data, job_data, perf_data)

    def load_job_artifacts(self, artifact_data):
        """
        Store a list of job artifacts. All of the datums in artifact_data need
        to be in the following format:

            {
                'type': 'json',
                'name': 'my-artifact-name',
                # blob can be any kind of structured data
                'blob': { 'stuff': [1, 2, 3, 4, 5] },
                'job_guid': 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
            }

        """
        job_artifact_list = []

        performance_artifact_list = []
        performance_artifact_job_id_list = []

        for index, artifact in enumerate(artifact_data):
            # Determine what type of artifact we have received
            if artifact:
                artifact_name = artifact.get('name')
                if not artifact_name:
                    logger.error("load_job_artifacts: Unnamed job artifact, "
                                 "skipping")
                    continue
                job_guid = artifact.get('job_guid')
                if not job_guid:
                    logger.error("load_job_artifacts: Artifact '{}' with no "
                                 "job guid set, skipping".format(
                                     artifact_name))
                    continue

                try:
                    job = Job.objects.get(guid=job_guid)
                except Job.DoesNotExist:
                    logger.error(
                        ('load_job_artifacts: No job_id for '
                         '{0} job_guid {1}'.format(self.project, job_guid)))
                    continue

                if artifact_name == 'performance_data':
                    self._adapt_performance_artifact_collection(
                        artifact, performance_artifact_list,
                        performance_artifact_job_id_list,
                        job.project_specific_id)
                elif artifact_name == 'Job Info':
                    self.store_job_details(job, artifact)
                else:
                    self._adapt_job_artifact_collection(
                        artifact, job_artifact_list,
                        job.project_specific_id)
            else:
                logger.error(
                    ('load_job_artifacts: artifact not '
                     'defined for {0}'.format(self.project)))

        # Store the various artifact types if we collected them
        if job_artifact_list:
            self.store_job_artifact(job_artifact_list)

        if performance_artifact_list and performance_artifact_job_id_list:
            self.store_performance_artifact(
                performance_artifact_job_id_list, performance_artifact_list)

    def _adapt_job_artifact_collection(
            self, artifact, artifact_data, job_id):

        if job_id:
            artifact_data.append((
                job_id,
                artifact['name'],
                artifact['type'],
                zlib.compress(artifact['blob']),
                job_id,
                artifact['name'],
            ))

    def _adapt_performance_artifact_collection(
            self, artifact, artifact_data, job_id_list, job_id):

        if job_id:
            job_id_list.append(job_id)
            artifact_data.append(artifact)

    def get_job_signatures_from_ids(self, job_ids):

        job_data = {}

        if job_ids:

            jobs_signatures_where_in_clause = [','.join(['%s'] * len(job_ids))]

            job_data = self.execute(
                proc='jobs.selects.get_signature_list_from_job_ids',
                debug_show=self.DEBUG,
                replace=jobs_signatures_where_in_clause,
                key_column='job_guid',
                return_type='dict',
                placeholders=job_ids)

        return job_data

    @staticmethod
    def serialize_artifact_json_blobs(artifacts):
        """
        Ensure that JSON artifact blobs passed as dicts are converted to JSON
        """
        for artifact in artifacts:
            blob = artifact['blob']
            if (artifact['type'].lower() == 'json' and
                    not isinstance(blob, str) and
                    not isinstance(blob, unicode)):
                artifact['blob'] = json.dumps(blob)

        return artifacts

    def bug_suggestions(self, job_id):
        """Get the list of log lines and associated bug suggestions for a job"""
        # TODO: Filter some junk from this
        objs = self.get_job_artifact_list(
            offset=0,
            limit=1,
            conditions={"job_id": set([("=", job_id)]),
                        "name": set([("=", "Bug suggestions")]),
                        "type": set([("=", "json")])})

        lines = objs[0]["blob"] if objs else []
        return lines

    def filter_bug_suggestions(self, suggestion_lines):
        return [item for item in suggestion_lines if is_helpful_search_term(item["search"])]
