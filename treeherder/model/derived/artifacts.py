# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import simplejson as json
import logging
import zlib

from treeherder.model import utils

from .base import TreeherderModelBase

from treeherder.etl.perf_data_adapters import (PerformanceDataAdapter,
                                               TalosDataAdapter)

logger = logging.getLogger(__name__)


class ArtifactsModel(TreeherderModelBase):

    """
    Represent the artifacts for a job repository

    content-types:
        jobs
    """

    # content types that every project will have
    CT_JOBS = "jobs"
    CONTENT_TYPES = [CT_JOBS]

    INDEXED_COLUMNS = {
        "job_artifact": {
            "id": "id",
            "job_id": "job_id",
            "name": "name",
            "type": "type"
        },
        "performance_artifact": {
            "id": "id",
            "job_id": "job_id",
            "series_signature": "series_signature",
            "name": "name",
            "type": "type"
        }
    }

    def jobs_execute(self, **kwargs):
        return utils.retry_execute(self.get_dhub(self.CT_JOBS), logger, **kwargs)

    def get_job_artifact_references(self, job_id):
        """
        Return the job artifact references for the given ``job_id``.

        This is everything about the artifact, but not the artifact blob
        itself.
        """
        data = self.jobs_execute(
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

        data = self.jobs_execute(
            proc=proc,
            replace=repl,
            placeholders=placeholders,
            limit="{0},{1}".format(offset, limit),
            debug_show=self.DEBUG,
        )
        for artifact in data:
            # new blobs are gzip'ed to save space, old ones may not be
            try:
                artifact["blob"] = zlib.decompress(artifact["blob"])
            except zlib.error:
                pass

            if artifact["type"] == "json":
                artifact["blob"] = json.loads(artifact["blob"])

        return data

    def get_performance_artifact_list(self, offset, limit, conditions=None):
        """
        Retrieve a list of performance artifacts. The conditions parameter is a
        dict containing a set of conditions for each key. e.g.:
        {
            'job_id': set([('IN', (1, 2))])
        }
        """

        replace_str, placeholders = self._process_conditions(
            conditions, self.INDEXED_COLUMNS['performance_artifact']
        )

        repl = [replace_str]

        proc = "jobs.selects.get_performance_artifact_list"

        data = self.jobs_execute(
            proc=proc,
            replace=repl,
            placeholders=placeholders,
            limit="{0},{1}".format(offset, limit),
            debug_show=self.DEBUG,
        )

        for artifact in data:
            # new blobs are gzip'ed to save space, old ones may not be
            try:
                artifact["blob"] = zlib.decompress(artifact["blob"])
            except zlib.error:
                pass

            # performance artifacts are always json encoded
            artifact["blob"] = json.loads(artifact["blob"])

        return data

    def get_max_performance_artifact_id(self):
        """Get the maximum performance artifact id."""
        data = self.jobs_execute(
            proc="jobs.selects.get_max_performance_artifact_id",
            debug_show=self.DEBUG,
        )
        return int(data[0]['max_id'] or 0)

    def store_job_artifact(self, artifact_placeholders):
        """
        Store a list of job_artifacts given a list of placeholders
        """
        self.jobs_execute(
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

        # Retrieve associated data in reference_data_signatures
        reference_data = self.refdata_model.get_reference_data(
            list(job_ref_data_signatures))

        tda = TalosDataAdapter()

        for perf_data in performance_artifact_placeholders:
            job_guid = perf_data["job_guid"]
            ref_data_signature = job_data[job_guid]['signature']
            ref_data = reference_data[ref_data_signature]

            if 'signature' in ref_data:
                del ref_data['signature']

            # adapt and load data into placeholder structures
            tda.adapt_and_load(ref_data, job_data, perf_data)

        self.jobs_execute(
            proc="jobs.inserts.set_performance_artifact",
            debug_show=self.DEBUG,
            placeholders=tda.performance_artifact_placeholders,
            executemany=True)

        self.jobs_execute(
            proc='jobs.inserts.set_series_signature',
            debug_show=self.DEBUG,
            placeholders=tda.signature_property_placeholders,
            executemany=True)

        tda.submit_tasks(self.project)

    def load_job_artifacts(self, artifact_data, job_id_lookup):
        """
        Determine what type of artifacts are contained in artifact_data and
        store a list of job artifacts substituting job_guid with job_id. All
        of the datums in artifact_data need to be one of the three
        different tasty "flavors" described below.

        artifact_placeholders:

            Comes in through the web service as the "artifacts" property
            in a job in a job collection

            A list of lists
            [
                [job_guid, name, artifact_type, blob, job_guid, name]
            ]

        job_artifact_collection:

            Comes in  through the web service as an artifact collection.

            A list of job artifacts:
            [
                {
                    'type': 'json',
                    'name': 'my-artifact-name',
                    # blob can be any kind of structured data
                    'blob': { 'stuff': [1, 2, 3, 4, 5] },
                    'job_guid': 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
                }
            ]

        performance_artifact:

            Same structure as a job_artifact_collection but the blob contains
            a specialized data structure designed for performance data.
        """
        artifact_placeholders_list = []
        job_artifact_list = []

        performance_artifact_list = []
        performance_artifact_job_id_list = []

        for index, artifact in enumerate(artifact_data):

            # Determine what type of artifact we have received
            if artifact:

                job_id = None
                job_guid = None

                if isinstance(artifact, list):
                    job_guid = artifact[0]
                    job_id = job_id_lookup.get(job_guid, {}).get('id', None)

                    self._adapt_job_artifact_placeholders(
                        artifact, artifact_placeholders_list, job_id)

                else:
                    artifact_name = artifact['name']
                    job_guid = artifact.get('job_guid', None)
                    job_id = job_id_lookup.get(
                        artifact['job_guid'], {}
                    ).get('id', None)

                    if artifact_name in PerformanceDataAdapter.performance_types:
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
        if artifact_placeholders_list:
            self.store_job_artifact(artifact_placeholders_list)

        if job_artifact_list:
            self.store_job_artifact(job_artifact_list)

        if performance_artifact_list and performance_artifact_job_id_list:
            self.store_performance_artifact(
                performance_artifact_job_id_list, performance_artifact_list)

    def _adapt_job_artifact_placeholders(
            self, artifact, artifact_placeholders_list, job_id):

        if job_id:
            # Replace job_guid with id in artifact data
            artifact[0] = job_id
            artifact[4] = job_id

            artifact_placeholders_list.append(artifact)

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

            job_data = self.jobs_execute(
                proc='jobs.selects.get_signature_list_from_job_ids',
                debug_show=self.DEBUG,
                replace=jobs_signatures_where_in_clause,
                key_column='job_guid',
                return_type='dict',
                placeholders=job_ids)

        return job_data

    @staticmethod
    def populate_placeholders(artifacts, artifact_placeholders, job_guid):
        for artifact in artifacts:
            name = artifact.get('name')
            artifact_type = artifact.get('type')

            blob = artifact.get('blob')
            if (artifact_type == 'json') and (not isinstance(blob, str)):
                blob = json.dumps(blob)

            if name and artifact_type and blob:
                artifact_placeholders.append(
                    [job_guid, name, artifact_type, blob, job_guid, name]
                )
