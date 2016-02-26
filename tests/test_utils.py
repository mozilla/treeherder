import json

from tests.sampledata import SampleData
from treeherder.client import TreeherderClient
from treeherder.model.derived.refdata import RefDataManager


def post_collection(project, th_collection):

    client = TreeherderClient(protocol='http', host='localhost')
    return client.post_collection(project, th_collection)


def do_job_ingestion(jm, refdata, job_data, sample_resultset, verify_data=True):
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
    coalesced_replacements = []
    artifacts_ref = {}

    blobs = []
    for index, blob in enumerate(job_data):

        if resultset_index > max_index:
            resultset_index = 0

        # Modify job structure to sync with the resultset sample data
        if 'sources' in blob:
            del blob['sources']

        blob['revision_hash'] = sample_resultset[resultset_index]['revision_hash']

        blobs.append(blob)

        resultset_index += 1

        # Build data structures to confirm everything is stored
        # as expected
        if verify_data:

            job_guid = blob['job']['job_guid']

            job = blob['job']

            build_platforms_ref.add(
                RefDataManager.get_platform_key(
                    job.get('build_platform', {}).get('os_name', 'unkown'),
                    job.get('build_platform', {}).get('platform', 'unkown'),
                    job.get('build_platform', {}).get('architecture', 'unknown')
                ))

            machine_platforms_ref.add(
                RefDataManager.get_platform_key(
                    job.get('machine_platform', {}).get('os_name', 'unkown'),
                    job.get('machine_platform', {}).get('platform', 'unkown'),
                    job.get('machine_platform', {}).get('architecture', 'unknown')
                ))

            machines_ref.add(job.get('machine', 'unknown'))

            options_ref = options_ref.union(job.get('option_collection', []).keys())

            job_types_ref.add(job.get('name', 'unknown'))
            products_ref.add(job.get('product_name', 'unknown'))
            result_sets_ref.add(blob['revision_hash'])

            log_url_list = job.get('log_references', [])
            for log_data in log_url_list:
                log_urls_ref.add(log_data['url'])

            artifact_name = job.get('artifact', {}).get('name')
            if artifact_name:
                artifacts_ref[artifact_name] = job.get('artifact')

            coalesced = blob.get('coalesced', [])
            if coalesced:
                coalesced_job_guids[job_guid] = coalesced
                coalesced_replacements.append('%s')

    # Store the modified json blobs
    jm.store_job_data(blobs)

    if verify_data:
        # Confirms stored data matches whats in the reference data structs
        verify_build_platforms(refdata, build_platforms_ref)
        verify_machine_platforms(refdata, machine_platforms_ref)
        verify_machines(refdata, machines_ref)
        verify_options(refdata, options_ref)
        verify_job_types(refdata, job_types_ref)
        verify_products(refdata, products_ref)
        verify_result_sets(jm, result_sets_ref)
        verify_log_urls(jm, log_urls_ref)
        verify_artifacts(jm, artifacts_ref)
        verify_coalesced(jm, coalesced_job_guids, coalesced_replacements)


def verify_build_platforms(refdata, build_platforms_ref):

    build_platforms = refdata.dhub.execute(
        proc='refdata_test.selects.test_all_build_platforms',
    )
    build_platforms_set = set()
    for build_platform in build_platforms:
        build_platforms_set.add(
            RefDataManager.get_platform_key(
                build_platform.get('os_name'),
                build_platform.get('platform'),
                build_platform.get('architecture')
            ))

    assert build_platforms_ref.issubset(build_platforms_set)


def verify_machine_platforms(refdata, machine_platforms_ref):

    machine_platforms = refdata.dhub.execute(
        proc='refdata_test.selects.test_all_machine_platforms',
    )
    machine_platforms_set = set()
    for machine_platform in machine_platforms:
        machine_platforms_set.add(
            RefDataManager.get_platform_key(
                machine_platform.get('os_name'),
                machine_platform.get('platform'),
                machine_platform.get('architecture')
            ))

    assert machine_platforms_ref.issubset(machine_platforms_set)


def verify_machines(refdata, machines_ref):

    machines = refdata.dhub.execute(
        proc='refdata_test.selects.test_all_machines',
        key_column='name',
        return_type='set'
    )

    assert machines_ref.issubset(machines)


def verify_options(refdata, options_ref):

    options = refdata.dhub.execute(
        proc='refdata_test.selects.test_all_options',
        key_column='name',
        return_type='set'
    )

    assert options_ref.issubset(options)


def verify_job_types(refdata, job_types_ref):

    job_types = refdata.dhub.execute(
        proc='refdata_test.selects.test_all_job_types',
        key_column='name',
        return_type='set'
    )

    assert job_types_ref.issubset(job_types)


def verify_products(refdata, products_ref):

    products = refdata.dhub.execute(
        proc='refdata_test.selects.test_all_products',
        key_column='name',
        return_type='set'
    )

    assert products_ref.issubset(products)


def verify_result_sets(jm, result_sets_ref):

    revision_hashes = jm.get_dhub().execute(
        proc='jobs.selects.get_all_result_set_revision_hashes',
        key_column='revision_hash',
        return_type='set'
    )

    assert result_sets_ref.issubset(revision_hashes)


def verify_log_urls(jm, log_urls_ref):

    log_urls = jm.get_dhub().execute(
        proc='jobs.selects.get_all_log_urls',
        key_column='url',
        return_type='set'
    )

    assert log_urls_ref.issubset(log_urls)


def verify_artifacts(jm, artifacts_ref):

    artifacts = jm.get_dhub().execute(
        proc='jobs.selects.get_all_artifacts',
        key_column='name',
        return_type='dict'
    )

    for key in artifacts.keys():
        assert artifacts[key]['name'] == artifacts_ref[key]['name']
        assert artifacts[key]['type'] == artifacts_ref[key]['type']
        assert json.loads(artifacts[key]['blob']) == artifacts_ref[key]['blob']


def verify_coalesced(jm, coalesced_job_guids, coalesced_replacements):

    coalesced_job_guid_list = coalesced_job_guids.keys()

    if coalesced_job_guid_list:

        rep_str = ','.join(coalesced_replacements)
        data = jm.get_dhub().execute(
            proc='jobs.selects.get_jobs_by_coalesced_guids',
            replace=[rep_str],
            placeholders=coalesced_job_guid_list
        )

        coalesced_job_guids_stored = {}
        for datum in data:
            if datum['job_coalesced_to_guid'] not in coalesced_job_guids_stored:
                coalesced_job_guids_stored[datum['job_coalesced_to_guid']] = []
            coalesced_job_guids_stored[datum['job_coalesced_to_guid']].append(
                datum['job_guid']
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
            return json.loads(f.read())
        except ValueError:
            # if it's not parse-able, return an empty dict
            return {}
