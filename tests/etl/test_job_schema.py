import jsonschema
import pytest

from treeherder.etl.schema import job_json_schema


# The test data in this file are a representative sample-set from
# production Treeherder


@pytest.mark.parametrize("group_symbol", ['?', 'A', 'Aries', 'Buri/Hamac', 'L10n', 'M-e10s'])
def test_group_symbols(sample_data, group_symbol):
    """
    Validate jobs against the schema with different group_symbol values
    """
    job = sample_data.pulse_jobs[0]
    job["origin"]["project"] = "proj"
    job["origin"]["revision"] = "1234567890123456789012345678901234567890"
    job["display"]["groupSymbol"] = group_symbol
    jsonschema.validate(job, job_json_schema)


@pytest.mark.parametrize("job_symbol", ['1.1g', '1g', '20', 'A', 'GBI10', 'en-US-1'])
def test_job_symbols(sample_data, job_symbol):
    """
        Validate jobs against the schema with different job_symbol values
    """
    job = sample_data.pulse_jobs[0]
    job["origin"]["project"] = "proj"
    job["origin"]["revision"] = "1234567890123456789012345678901234567890"
    job["display"]["jobSymbol"] = job_symbol
    jsonschema.validate(job, job_json_schema)
