from treeherder.model.models import JobNote


def test_note_deletion(test_job_with_notes):
    # verify that default classification is last note's
    # classification
    assert test_job_with_notes.failure_classification_id == 3

    # delete second failure classification, verify that we now have first one
    # (after reloading job)
    JobNote.objects.get(job=test_job_with_notes,
                        failure_classification_id=3).delete()
    test_job_with_notes.refresh_from_db()
    assert test_job_with_notes.failure_classification_id == 2

    # delete second failure classification, verify that we have unclassified
    # status
    JobNote.objects.get(job=test_job_with_notes).delete()
    test_job_with_notes.refresh_from_db()
    assert test_job_with_notes.failure_classification_id == 1
