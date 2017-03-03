import time

from django.core.management import call_command

from tests.sample_data_generator import job_data
from treeherder.etl.jobs import store_job_data
from treeherder.model.models import (Job,
                                     JobDuration)


def test_calculate_durations(test_repository, failure_classifications,
                             result_set_stored, mock_log_parser):
    """
    Test the calculation of average job durations and their use during
    subsequent job ingestion.
    """
    now = int(time.time())

    first_job_duration = 120
    first_job = job_data(revision=result_set_stored[0]['revision'],
                         start_timestamp=now,
                         end_timestamp=now + first_job_duration)
    store_job_data(test_repository, [first_job])

    # Generate average duration based on the first job.
    call_command('calculate_durations')

    # Ingest the same job type again to check that the pre-generated
    # average duration is used during ingestion.
    second_job_duration = 142
    second_job = job_data(revision=result_set_stored[0]['revision'],
                          start_timestamp=now,
                          end_timestamp=now + second_job_duration,
                          job_guid='a-different-unique-guid')
    store_job_data(test_repository, [second_job])
    ingested_second_job = Job.objects.get(id=2)
    assert ingested_second_job.running_eta == first_job_duration

    # Check that the average duration is updated now that there are two jobs.
    call_command('calculate_durations')
    durations = JobDuration.objects.all()
    assert len(durations) == 1
    expected_duration = int(round((first_job_duration + second_job_duration) / 2))
    assert durations[0].average_duration == expected_duration

    # Add a fake job with an end time > start time, verify that it is
    # ignored and average duration remains the same
    third_job = job_data(revision=result_set_stored[0]['revision'],
                         start_timestamp=now,
                         end_timestamp=now - second_job_duration,
                         job_guid='another-unique-guid')
    store_job_data(test_repository, [third_job])
    call_command('calculate_durations')
    durations = JobDuration.objects.all()
    assert len(durations) == 1
    assert durations[0].average_duration == expected_duration
