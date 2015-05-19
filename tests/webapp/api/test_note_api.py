# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import json
from django.core.urlresolvers import reverse
from rest_framework.test import APIClient
from django.contrib.auth.models import User


def test_note_list(webapp, sample_notes, jm):
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
            "failure_classification_id": 0,
            "who": "kellyclarkson",
            "note": "you look like a man-o-lantern",
            "active_status": "active",
        },
        {
            "job_id": job_id,
            "failure_classification_id": 1,
            "who": "kellyclarkson",
            "note": "you look like a man-o-lantern",
            "active_status": "active",
        }
    ]

    import pprint
    assert exp_notes == note_list, pprint.pprint({
        "exp": exp_notes,
        "act": note_list
    })

    jm.disconnect()


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

    jm.disconnect()


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

    jm.disconnect()


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

    jm.disconnect()


def test_create_note(webapp, eleven_jobs_processed, mock_message_broker, jm):
    """
    test creating a single note via endpoint when authenticated
    """
    client = APIClient()
    user = User.objects.create(username="MyName", email="foo@bar.com")
    client.force_authenticate(user=user)

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

    user.delete()

    assert resp.status_code == 200

    content = json.loads(resp.content)
    assert content['message'] == 'note stored for job %s' % job["id"]

    note_list = jm.get_job_note_list(job_id=job["id"])
    del(note_list[0]["note_timestamp"])

    assert note_list[0] == {
        u'job_id': job["id"],
        u'who': u'foo@bar.com',
        u'failure_classification_id': 2L,
        u'note': u'you look like a man-o-lantern',
        u'active_status': u'active',
        u'id': 1L
    }

    jm.disconnect()


def test_create_note_no_auth(eleven_jobs_processed, jm):
    """
    test creating a single note via endpoint when not authenticated
    gets a 403 Forbidden
    """
    client = APIClient()
    user = User.objects.create(username="MyName")

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

    user.delete()

    assert resp.status_code == 403


def test_delete_note(webapp, sample_notes, mock_message_broker, jm):
    """
    test creating a single note via endpoint
    """
    client = APIClient()
    user = User.objects.create(username="MyName", is_staff=True)
    client.force_authenticate(user=user)

    notes = jm.get_job_note_list(job_id=1)

    resp = client.delete(
        reverse("note-detail", kwargs={"project": jm.project, "pk": notes[0]['id']}),
    )
    new_notes = jm.get_job_note_list(job_id=1)

    user.delete()

    assert resp.status_code == 200, resp

    assert len(new_notes) == len(notes) - 1

    jm.disconnect()
