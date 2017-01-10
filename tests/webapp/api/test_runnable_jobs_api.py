from django.core.urlresolvers import reverse

from treeherder.model.models import RunnableJob


def test_runnable_jobs_api(webapp, test_job):
    RunnableJob.objects.create(
        build_platform=test_job.build_platform,
        machine_platform=test_job.machine_platform,
        job_type=test_job.job_type,
        option_collection_hash=test_job.option_collection_hash,
        ref_data_name=test_job.signature.name,
        build_system_type=test_job.signature.build_system_type,
        repository=test_job.repository)
    url = reverse("runnable_jobs-list",
                  kwargs={"project": test_job.repository.name})
    resp = webapp.get(url).json
    assert resp == {
        'meta': {
            'count': 1,
            'offset': 0,
            'repository': test_job.repository.name
        },
        'results': [{
            'build_architecture': 'x86',
            'build_os': 'b2g',
            'build_platform': 'b2g-emu-jb',
            'build_platform_id': 1,
            'build_system_type': 'buildbot',
            'job_coalesced_to_guid': None,
            'job_group_description': '',
            'job_group_id': 1,
            'job_group_name': 'unknown',
            'job_group_symbol': '?',
            'job_type_description': '',
            'job_type_id': 1,
            'job_type_name': 'B2G Emulator Image Build',
            'job_type_symbol': 'B',
            'machine_platform_architecture': 'x86',
            'machine_platform_id': 1,
            'machine_platform_os': 'b2g',
            'option_collection_hash': '32faaecac742100f7753f0c1d0aa0add01b4046b',
            'platform': 'b2g-emu-jb',
            'platform_option': 'debug',
            'ref_data_name': 'b2g_mozilla-release_emulator-jb-debug_dep',
            'result': 'runnable',
            'state': 'runnable'}]
    }
