import datetime
import json

from tests.sampledata import SampleData
from treeherder.client import TreeherderClient
from treeherder.model import models


def post_collection(project, th_collection):

    client = TreeherderClient(server_url='http://localhost')
    return client.post_collection(project, th_collection)


def do_job_ingestion(jm, job_data, sample_resultset, verify_data=True):
    """
    Ingest ``job_data`` which will be JSON job blobs.

    ``verify_data`` - whether or not to run the ingested jobs
                      through the verifier.
    """
    jm.store_result_set_data(sample_resultset)

    max_index = len(sample_resultset) - 1
    resultset_index = 0

    # Structures to test if we stored everything
    build_platforms_ref = set()
    machine_platforms_ref = set()

    machines_ref = set()
    options_ref = set()
    job_types_ref = set()
    products_ref = set()
    result_sets_ref = set()
    log_urls_ref = set()
    coalesced_job_guids = {}
    artifacts_ref = {}

    blobs = []
    for index, blob in enumerate(job_data):

        if resultset_index > max_index:
            resultset_index = 0

        # Modify job structure to sync with the resultset sample data
        if 'sources' in blob:
            del blob['sources']

        blob['revision'] = sample_resultset[resultset_index]['revision']

        blobs.append(blob)

        resultset_index += 1

        # Build data structures to confirm everything is stored
        # as expected
        if verify_data:

            job_guid = blob['job']['job_guid']

            job = blob['job']

            build_platforms_ref.add(
                "-".join([
                    job.get('build_platform', {}).get('os_name', 'unknown'),
                    job.get('build_platform', {}).get('platform', 'unknown'),
                    job.get('build_platform', {}).get('architecture', 'unknown')
                ]))

            machine_platforms_ref.add(
                "-".join([
                    job.get('machine_platform', {}).get('os_name', 'unknown'),
                    job.get('machine_platform', {}).get('platform', 'unknown'),
                    job.get('machine_platform', {}).get('architecture', 'unknown')
                ]))

            machines_ref.add(job.get('machine', 'unknown'))

            options_ref = options_ref.union(job.get('option_collection', []).keys())

            job_types_ref.add(job.get('name', 'unknown'))
            products_ref.add(job.get('product_name', 'unknown'))
            result_sets_ref.add(blob['revision'])

            log_url_list = job.get('log_references', [])
            for log_data in log_url_list:
                log_urls_ref.add(log_data['url'])

            artifact_name = job.get('artifact', {}).get('name')
            if artifact_name:
                artifacts_ref[artifact_name] = job.get('artifact')

            coalesced = blob.get('coalesced', [])
            if coalesced:
                coalesced_job_guids[job_guid] = coalesced

    # Store the modified json blobs
    jm.store_job_data(blobs)

    if verify_data:
        # Confirms stored data matches whats in the reference data structs
        verify_build_platforms(build_platforms_ref)
        verify_machine_platforms(machine_platforms_ref)
        verify_machines(machines_ref)
        verify_options(options_ref)
        verify_job_types(job_types_ref)
        verify_products(products_ref)
        verify_result_sets(jm, result_sets_ref)
        verify_log_urls(jm, log_urls_ref)
        verify_coalesced(coalesced_job_guids)


def verify_build_platforms(build_platforms_ref):

    build_platforms_set = set()
    for build_platform in models.BuildPlatform.objects.all():
        build_platforms_set.add(
            "-".join([
                build_platform.os_name,
                build_platform.platform,
                build_platform.architecture
            ]))

    assert build_platforms_ref.issubset(build_platforms_set)


def verify_machine_platforms(machine_platforms_ref):

    machine_platforms_set = set()
    for machine_platform in models.MachinePlatform.objects.all():
        machine_platforms_set.add(
            "-".join([
                machine_platform.os_name,
                machine_platform.platform,
                machine_platform.architecture
            ]))

    assert machine_platforms_ref.issubset(machine_platforms_set)


def verify_machines(machines_ref):

    machines = models.Machine.objects.all().values_list('name', flat=True)
    assert machines_ref.issubset(machines)


def verify_options(options_ref):

    options = models.Option.objects.all().values_list('name', flat=True)

    assert options_ref.issubset(options)


def verify_job_types(job_types_ref):

    job_types = models.JobType.objects.all().values_list('name', flat=True)
    assert job_types_ref.issubset(job_types)


def verify_products(products_ref):

    products = models.Product.objects.all().values_list('name', flat=True)

    assert products_ref.issubset(products)


def verify_result_sets(jm, result_sets_ref):

    return result_sets_ref.issubset(models.Push.objects.values_list(
        'revision', flat=True))


def verify_log_urls(jm, log_urls_ref):

    log_urls = set(models.JobLog.objects.values_list('url', flat=True))

    assert log_urls_ref.issubset(log_urls)


def verify_coalesced(coalesced_job_guids):

    coalesced_job_guid_list = coalesced_job_guids.keys()

    if coalesced_job_guid_list:
        coalesced_guids = models.Job.objects.filter(
            coalesced_to_guid__in=coalesced_job_guid_list).values_list(
                'guid', 'coalesced_to_guid')
        coalesced_job_guids_stored = {}
        for (guid, coalesced_guid) in coalesced_guids:
            if coalesced_guid not in coalesced_job_guids_stored:
                coalesced_job_guids_stored[coalesced_guid] = []
            coalesced_job_guids_stored[coalesced_guid].append(
                guid
            )

        assert coalesced_job_guids_stored == coalesced_job_guids


def load_exp(filename):
    """
    Load in an expected result json and return as an obj.

    If the file doesn't exist, it will be created, but the test will
    fail, due to no content.  This is to make it easier during test
    development.
    """
    path = SampleData().get_log_path(filename)
    with open(path, "a+") as f:
        try:
            return json.load(f)
        except ValueError:
            # if it's not parse-able, return an empty dict
            return {}


def create_generic_job(guid, repository, push_id, project_specific_id,
                       generic_reference_data):
    job_time = datetime.datetime.fromtimestamp(0)
    return models.Job.objects.create(
        guid=guid,
        repository=repository,
        push_id=push_id,
        signature=generic_reference_data.signature,
        build_platform=generic_reference_data.build_platform,
        machine_platform=generic_reference_data.machine_platform,
        machine=generic_reference_data.machine,
        option_collection_hash=generic_reference_data.option_collection_hash,
        job_type=generic_reference_data.job_type,
        product=generic_reference_data.product,
        failure_classification_id=1,
        who='testuser@foo.com',
        reason='success',
        result='finished',
        state='completed',
        submit_time=job_time,
        start_time=job_time,
        end_time=job_time,
        project_specific_id=project_specific_id,
        tier=1)
