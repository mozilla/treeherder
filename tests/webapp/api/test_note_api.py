import json

import pytest
from django.core.urlresolvers import reverse

from treeherder.model.models import (Job,
                                     JobNote)


def test_note_list(client, test_job_with_notes):
    """
    test retrieving a list of notes from the note-list endpoint
    """
    resp = client.get(
        reverse("note-list", kwargs={
            "project": test_job_with_notes.repository.name
        }),
        {"job_id": test_job_with_notes.id}
    )

    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert resp.json() == [{
        "id": note.id,
        "job_id": note.job.id,
        "failure_classification_id": note.failure_classification.id,
        "who": note.user.email,
        "created": note.created.isoformat(),
        "text": note.text
    } for note in JobNote.objects.filter(job=test_job_with_notes)]


def test_note_detail(client, test_job_with_notes):
    """
    test retrieving a single note from the notes-detail
    endpoint.
    """
    note = JobNote.objects.get(id=1)

    resp = client.get(
        reverse("note-detail",
                kwargs={
                    "project": test_job_with_notes.repository.name,
                    "pk": 1
                })
    )

    assert resp.status_code == 200
    assert isinstance(resp.json(), dict)
    assert resp.json() == {
        "id": 1,
        "job_id": note.job.id,
        "failure_classification_id": 2,
        "who": note.user.email,
        "created": note.created.isoformat(),
        "text": "you look like a man-o-lantern"
    }


def test_note_detail_not_found(client, test_repository):
    """
    test retrieving a HTTP 404 from the note-detail
    endpoint.
    """
    resp = client.get(
        reverse("note-detail",
                kwargs={"project": test_repository.name, "pk": -32767}),
    )
    assert resp.status_code == 404


def test_note_detail_bad_project(client, test_repository):
    """
    test retrieving a HTTP 404 from the note-detail
    endpoint.
    """
    resp = client.get(
        reverse("note-detail",
                kwargs={"project": "foo", "pk": -32767}),
    )
    assert resp.status_code == 404


@pytest.mark.parametrize('test_no_auth', [True, False])
def test_create_note(client, test_job, mock_message_broker,
                     test_user, test_no_auth):
    """
    test creating a single note via endpoint when authenticated
    """
    if not test_no_auth:
        client.force_authenticate(user=test_user)

    resp = client.post(
        reverse("note-list", kwargs={"project": test_job.repository.name}),
        data={
            "job_id": test_job.id,
            "failure_classification_id": 2,
            "who": test_user.email,
            "text": "you look like a man-o-lantern"
        },
    )

    if test_no_auth:
        assert resp.status_code == 403
        assert JobNote.objects.count() == 0
    else:
        assert resp.status_code == 200

        content = json.loads(resp.content)
        assert content['message'] == 'note stored for job %s' % test_job.id

        note_list = JobNote.objects.filter(job=test_job)

        assert len(note_list) == 1
        assert note_list[0].user == test_user
        assert note_list[0].failure_classification.id == 2
        assert note_list[0].text == 'you look like a man-o-lantern'

        # verify that the job's last_modified field got updated
        old_last_modified = test_job.last_modified
        assert old_last_modified < Job.objects.values_list(
            'last_modified', flat=True).get(id=test_job.id)


@pytest.mark.parametrize('test_no_auth', [True, False])
def test_delete_note(client, test_job_with_notes, mock_message_broker, test_repository,
                     test_sheriff, test_no_auth):
    """
    test deleting a single note via endpoint
    """
    if not test_no_auth:
        client.force_authenticate(user=test_sheriff)

    notes_count = JobNote.objects.count()

    resp = client.delete(
        reverse("note-detail", kwargs={"project": test_repository.name,
                                       "pk": test_job_with_notes.id}),
    )
    new_notes_count = JobNote.objects.count()

    if test_no_auth:
        assert resp.status_code == 403
        assert new_notes_count == notes_count
    else:
        assert resp.status_code == 200, resp
        assert new_notes_count == notes_count - 1
