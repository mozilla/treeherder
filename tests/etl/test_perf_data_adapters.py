# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import json

from tests.sampledata import SampleData
from treeherder.etl.perf_data_adapters import TalosDataAdapter


def test_adapt_and_load():

    talos_perf_data = SampleData.get_talos_perf_data()

    ref_data = {
        "test": 1
    }

    tda = TalosDataAdapter()

    result_count = 0
    for datum in talos_perf_data:

        datum = {
            "job_guid": 'oqiwy0q847365qiu',
            "name": "test",
            "type": "test",
            "blob": datum
        }

        job_data = {
            "oqiwy0q847365qiu": {
                "id":1,
                "result_set_id":1,
                "push_timestamp":1402692388
            }
        }

        reference_data = {
            "property1":"value1",
            "property2":"value2",
            "property3":"value3"
        }

        result_count += len(datum['blob']["results"])

        # Mimic production environment, the blobs are serialized
        # when the web service receives them
        datum['blob'] = json.dumps({ 'talos_data':[ datum['blob'] ]})
        tda.adapt_and_load(reference_data, job_data, datum)

    assert result_count == len( tda.performance_artifact_placeholders )
