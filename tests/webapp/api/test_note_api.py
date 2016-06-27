import json

from django.core.urlresolvers import reverse
from rest_framework.test import APIClient


def test_note_list(webapp, sample_notes, jm, test_user):
    """
    test retrieving a list of notes from the note-list endpoint
    """
    job_id = jm.get_job_list(0, 1)[0]["id"]
    resp = webapp.get(
        reverse("note-list", kwargs={"project": jm.project}),
        {"job_id": job_id}
    )

    assert resp.status_int == 200
    assert isinstance(resp.json, list)
    note_list = resp.json

    assert set(note_list[0].keys()) == {
        'note_timestamp',
        'job_id',
        'who',
        'failure_classification_id',
        'note',
        'active_status',
        'id'
    }

    # remove fields we don't want to compare
    for note in note_list:
        del(note["note_timestamp"])
        del(note["id"])

    assert len(note_list) == 2
    exp_notes = [
        {
            "job_id": job_id,
            "failure_classification_id": 1,
            "who": test_user.email,
            "note": "you look like a man-o-lantern",
            "active_status": "active",
        },
        {
            "job_id": job_id,
            "failure_classification_id": 0,
            "who": test_user.email,
            "note": "you look like a man-o-lantern",
            "active_status": "active",
        }
    ]

    import pprint
    assert exp_notes == note_list, pprint.pprint({
        "exp": exp_notes,
        "act": note_list
    })


def test_note_detail(webapp, sample_notes, jm):
    """
    test retrieving a single note from the notes-detail
    endpoint.
    """
    job = jm.get_job_list(0, 1)[0]
    note = jm.get_job_note_list(job_id=job["id"])[0]

    resp = webapp.get(
        reverse("note-detail",
                kwargs={"project": jm.project, "pk": int(note["id"])})
    )

    assert resp.status_int == 200
    assert isinstance(resp.json, dict)
    assert resp.json["id"] == note["id"]
    assert set(resp.json.keys()) == set([
        'note_timestamp',
        'job_id',
        'who',
        'failure_classification_id',
        'note',
        'active_status',
        'id'
    ])


def test_note_detail_not_found(webapp, jm):
    """
    test retrieving a HTTP 404 from the note-detail
    endpoint.
    """
    resp = webapp.get(
        reverse("note-detail",
                kwargs={"project": jm.project, "pk": -32767}),
        expect_errors=True
    )
    assert resp.status_int == 404


def test_note_detail_bad_project(webapp, jm):
    """
    test retrieving a HTTP 404 from the note-detail
    endpoint.
    """
    resp = webapp.get(
        reverse("note-detail",
                kwargs={"project": "foo", "pk": -32767}),
        expect_errors=True
    )
    assert resp.status_int == 404
    assert resp.json == {"detail": "No project with name foo"}


def test_create_note(webapp, eleven_jobs_stored, mock_message_broker, jm,
                     test_user):
    """
    test creating a single note via endpoint when authenticated
    """
    client = APIClient()
    client.force_authenticate(user=test_user)

    job = jm.get_job_list(0, 1)[0]
    resp = client.post(
        reverse("note-list", kwargs={"project": jm.project}),
        {
            "job_id": job["id"],
            "failure_classification_id": 2,
            "who": test_user.email,
            "note": "you look like a man-o-lantern"
        }
    )

    assert resp.status_code == 200

    content = json.loads(resp.content)
    assert content['message'] == 'note stored for job %s' % job["id"]

    note_list = jm.get_job_note_list(job_id=job["id"])
    del(note_list[0]["note_timestamp"])

    assert note_list[0] == {
        u'job_id': job["id"],
        u'who': test_user.email,
        u'failure_classification_id': 2L,
        u'note': u'you look like a man-o-lantern',
        u'active_status': u'active',
        u'id': 1L
    }


def test_create_note_no_auth(eleven_jobs_stored, jm):
    """
    test creating a single note via endpoint when not authenticated
    gets a 403 Forbidden
    """
    client = APIClient()

    job = jm.get_job_list(0, 1)[0]
    resp = client.post(
        reverse("note-list", kwargs={"project": jm.project}),
        {
            "job_id": job["id"],
            "failure_classification_id": 2,
            "who": "kelly clarkson",
            "note": "you look like a man-o-lantern"
        }
    )

    assert resp.status_code == 403


def test_delete_note(webapp, sample_notes, mock_message_broker, jm,
                     test_sheriff):
    """
    test creating a single note via endpoint
    """
    client = APIClient()
    client.force_authenticate(user=test_sheriff)

    notes = jm.get_job_note_list(job_id=1)

    resp = client.delete(
        reverse("note-detail", kwargs={"project": jm.project, "pk": notes[0]['id']}),
    )
    new_notes = jm.get_job_note_list(job_id=1)

    assert resp.status_code == 200, resp

    assert len(new_notes) == len(notes) - 1
