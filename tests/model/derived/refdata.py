import os
import pytest
from django.conf import settings
from treeherder.model.derived import RefDataManager
from datasource.bases.BaseHub import BaseHub


@pytest.fixture(scope="module")
def refdata():
    """returns a patched RefDataManager for testing purpose"""

    refdata = RefDataManager()

    #make the test procs available to RefDataManager
    del BaseHub.procs['reference']
    refdata.dhub.data_sources['reference']["procs"].append(
        os.path.join(
            os.path.abspath(os.path.dirname(__file__)),
            "refdata_test.json"
        )
    )
    refdata.dhub.load_procs('reference')
    return refdata


def test_build_platform_manager(refdata):
    # platform'Fedora 12', 'os_name': 'linux', 'architecture': 'x86_64'

    build_platform_id = refdata.get_or_create_build_platform(
        'linux',
        'Fedora 12',
        'x86_64',)
    print build_platform_id
    row_data = refdata.dhub.execute(
        proc="refdata_test.selects.test_build_platform_manager",
        placeholders=[build_platform_id]
    )[0]

    assert row_data["os_name"] == 'linux'
    assert row_data["platform"] == 'Fedora 12'
    assert row_data["architecture"] == 'x86_64'
