import json

from requests import Request
from webtest.app import TestApp

from tests.sampledata import SampleData
from treeherder.client import TreeherderAuth, TreeherderClient
from treeherder.etl.oauth_utils import OAuthCredentials
from treeherder.model.derived.refdata import RefDataManager
from treeherder.config.wsgi import application


def post_collection(
        project, th_collection, status=None, expect_errors=False,
        consumer_key=None, consumer_secret=None):

    # Set the credentials
    OAuthCredentials.set_credentials(SampleData.get_credentials())

    credentials = OAuthCredentials.get_credentials(project)

    # The only time the credentials should be overridden are when
    # a client needs to test authentication failure confirmation
    consumer_key = consumer_key or credentials['consumer_key']
    consumer_secret = consumer_secret or credentials['consumer_secret']

    auth = TreeherderAuth(consumer_key, consumer_secret, project)
    client = TreeherderClient(protocol='http', host='localhost', auth=auth)
    uri = client._get_project_uri(project, th_collection.endpoint_base)

    req = Request('POST', uri,
                  json=th_collection.get_collection_data(),
                  auth=auth)
    prepped_request = req.prepare()

    response = TestApp(application).post_json(
        prepped_request.url,
        params=th_collection.get_collection_data(),
        status=status
    )

    return response


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


def unicode_keys(d):
    return dict([(unicode(k), v) for k, v in d.items()])


def clean_source_blob_dict(src):
    """Fix a few fields so they're easier to compare"""
    src["commit_timestamp"] = long(src["commit_timestamp"])
    src["push_timestamp"] = long(src["push_timestamp"])
    return src


def clean_job_blob_dict(job):
    """Fix a few fields so they're easier to compare"""
    job["start_timestamp"] = long(job["start_timestamp"])
    job["submit_timestamp"] = long(job["submit_timestamp"])
    job["end_timestamp"] = long(job["end_timestamp"])
    job["result"] = unicode(job["result"])

    # move artifact logs to log_references area for comparison
    try:
        artlog = job["artifact"]["log_urls"]
        job["log_references"].extend(artlog)
        del(job["artifact"]["log_urls"])
    except KeyError:
        pass  # no problem

    # @@@ we don't keep track of VM'ness?
    try:
        del(job["machine_platform"]["vm"])
    except KeyError:
        pass  # no problem
    try:
        del(job["build_platform"]["vm"])
    except KeyError:
        pass  # no problem

    return job


def ingest_talos_performance_data(jm, refdata, sample_data, sample_resultset):

    talos_perf_data = sample_data.get_talos_perf_data()

    job_data = sample_data.job_data[:20]
    do_job_ingestion(
        jm, refdata, job_data, sample_resultset, False)
    job_guids = map(lambda job: job['job']['job_guid'], job_data)

    job_id_lookup = jm.get_job_ids_by_guid(job_guids)
    job_ids = map(lambda job_guid: job_id_lookup[job_guid]['id'], job_guids)

    # Dynamically map the job_guids to the talos test objects
    # so that reference data will exist for the talos blobs
    talos_perf_index_max = len(talos_perf_data)
    talos_perf_index = 0
    perf_data = []

    for job_guid in job_guids:
        perf_data.append({
            "job_guid": job_guid,
            "name": "talos",
            "type": "performance",
            "blob": talos_perf_data[talos_perf_index]
        })

        # cycle through the talos perf indexes so we test all of
        # the sample structures
        if talos_perf_index == talos_perf_index_max - 1:
            talos_perf_index = 0

    return {
        "job_ids": job_ids,
        "perf_data": perf_data
    }
