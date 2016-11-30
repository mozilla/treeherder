from treeherder.model.models import (Job,
                                     JobNote)


def test_note_deletion(eleven_jobs_with_notes):
    job = Job.objects.get(id=1)
    # verify that default classification is last note's
    # classification
    assert job.failure_classification_id == 3

    # delete second failure classification, verify that we now have first one
    JobNote.objects.get(job=job, failure_classification_id=3).delete()
    job = Job.objects.get(id=1)
    assert job.failure_classification_id == 2

    # delete second failure classification, verify that we have unclassified
    # status
    JobNote.objects.get(job=job).delete()
    job = Job.objects.get(id=1)
    assert job.failure_classification_id == 1
