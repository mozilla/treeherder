import logging
import zlib

import simplejson as json
from django.forms import model_to_dict

from treeherder.etl.perf import load_perf_artifacts
from treeherder.model import utils
from treeherder.model.models import ReferenceDataSignatures

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

    def load_job_artifacts(self, artifact_data, job_id_lookup):
        """
        Store a list of job artifacts substituting job_guid with job_id. All
        of the datums in artifact_data need to be in the following format:

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

                job_id = None
                job_guid = None

                artifact_name = artifact['name']
                job_guid = artifact.get('job_guid', None)
                job_id = job_id_lookup.get(
                    artifact['job_guid'], {}
                ).get('id', None)

                if artifact_name == 'performance_data':
                    self._adapt_performance_artifact_collection(
                        artifact, performance_artifact_list,
                        performance_artifact_job_id_list, job_id)
                else:
                    self._adapt_job_artifact_collection(
                        artifact, job_artifact_list, job_id)

                if not job_id:
                    logger.error(
                        ('load_job_artifacts: No job_id for '
                         '{0} job_guid {1}'.format(self.project, job_guid)))

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
