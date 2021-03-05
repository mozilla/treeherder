import datetime
import json

import responses

from tests.sampledata import SampleData
from treeherder.etl.jobs import store_job_data
from treeherder.etl.push import store_push_data
from treeherder.model import models


def do_job_ingestion(test_repository, job_data, sample_push, verify_data=True):
    """
    Ingest ``job_data`` which will be JSON job blobs.

    ``verify_data`` - whether or not to run the ingested jobs
                      through the verifier.
    """
    store_push_data(test_repository, sample_push)

    max_index = len(sample_push) - 1
    push_index = 0

    # Structures to test if we stored everything
    build_platforms_ref = set()
    machine_platforms_ref = set()

    machines_ref = set()
    options_ref = set()
    job_types_ref = set()
    products_ref = set()
    pushes_ref = set()
    log_urls_ref = set()
    superseded_job_guids = set()
    artifacts_ref = {}

    blobs = []
    for blob in job_data:

        if push_index > max_index:
            push_index = 0

        # Modify job structure to sync with the push sample data
        if 'sources' in blob:
            del blob['sources']

        blob['revision'] = sample_push[push_index]['revision']

        blobs.append(blob)

        push_index += 1

        # Build data structures to confirm everything is stored
        # as expected
        if verify_data:
            job = blob['job']

            build_platforms_ref.add(
                "-".join(
                    [
                        job.get('build_platform', {}).get('os_name', 'unknown'),
                        job.get('build_platform', {}).get('platform', 'unknown'),
                        job.get('build_platform', {}).get('architecture', 'unknown'),
                    ]
                )
            )

            machine_platforms_ref.add(
                "-".join(
                    [
                        job.get('machine_platform', {}).get('os_name', 'unknown'),
                        job.get('machine_platform', {}).get('platform', 'unknown'),
                        job.get('machine_platform', {}).get('architecture', 'unknown'),
                    ]
                )
            )

            machines_ref.add(job.get('machine', 'unknown'))

            options_ref = options_ref.union(job.get('option_collection', []).keys())

            job_types_ref.add(job.get('name', 'unknown'))
            products_ref.add(job.get('product_name', 'unknown'))
            pushes_ref.add(blob['revision'])

            log_url_list = job.get('log_references', [])
            for log_data in log_url_list:
                log_urls_ref.add(log_data['url'])

            artifact_name = job.get('artifact', {}).get('name')
            if artifact_name:
                artifacts_ref[artifact_name] = job.get('artifact')

            superseded = blob.get('superseded', [])
            superseded_job_guids.update(superseded)

    # Store the modified json blobs
    store_job_data(test_repository, blobs)

    if verify_data:
        # Confirms stored data matches whats in the reference data structs
        verify_build_platforms(build_platforms_ref)
        verify_machine_platforms(machine_platforms_ref)
        verify_machines(machines_ref)
        verify_options(options_ref)
        verify_job_types(job_types_ref)
        verify_products(products_ref)
        verify_pushes(test_repository, pushes_ref)
        verify_log_urls(test_repository, log_urls_ref)
        verify_superseded(superseded_job_guids)


def verify_build_platforms(build_platforms_ref):

    build_platforms_set = set()
    for build_platform in models.BuildPlatform.objects.all():
        build_platforms_set.add(
            "-".join([build_platform.os_name, build_platform.platform, build_platform.architecture])
        )

    assert build_platforms_ref.issubset(build_platforms_set)


def verify_machine_platforms(machine_platforms_ref):

    machine_platforms_set = set()
    for machine_platform in models.MachinePlatform.objects.all():
        machine_platforms_set.add(
            "-".join(
                [machine_platform.os_name, machine_platform.platform, machine_platform.architecture]
            )
        )

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


def verify_pushes(test_repository, pushes_ref):

    return pushes_ref.issubset(models.Push.objects.values_list('revision', flat=True))


def verify_log_urls(test_repository, log_urls_ref):

    log_urls = set(models.JobLog.objects.values_list('url', flat=True))

    assert log_urls_ref.issubset(log_urls)


def verify_superseded(expected_superseded_job_guids):
    superseeded_guids = models.Job.objects.filter(result='superseded').values_list(
        'guid', flat=True
    )
    assert set(superseeded_guids) == expected_superseded_job_guids


def load_exp(filename):
    """
    Load in an expected result json and return as an obj.
    """
    path = SampleData().get_log_path(filename)
    with open(path) as f:
        return json.load(f)


def create_generic_job(guid, repository, push_id, generic_reference_data, tier=None):
    if tier is None:
        tier = 1

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
        job_group=generic_reference_data.job_group,
        product=generic_reference_data.product,
        failure_classification_id=1,
        who='testuser@foo.com',
        reason='success',
        result='finished',
        state='completed',
        submit_time=job_time,
        start_time=job_time,
        end_time=job_time,
        tier=tier,
    )


def add_log_response(filename):
    """
    Set up responses for a local gzipped log and return the url for it.
    """
    log_path = SampleData().get_log_path(filename)
    log_url = "http://my-log.mozilla.org/{}".format(filename)

    with open(log_path, 'rb') as log_file:
        content = log_file.read()
        responses.add(
            responses.GET,
            log_url,
            body=content,
            adding_headers={
                'Content-Encoding': 'gzip',
                'Content-Length': str(len(content)),
            },
        )
    return log_url
