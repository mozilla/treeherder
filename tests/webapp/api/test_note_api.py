import json
import pytest
from django.core.urlresolvers import reverse

xfail = pytest.mark.xfail


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

    assert set(note_list[0].keys()) == set([
        'note_timestamp',
        'job_id',
        'who',
        'failure_classification_id',
        'note',
        'active_status',
        'id'
    ])

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
    assert exp_notes == note_list, pprint.pprint(note_list)


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
    assert resp.json == {
        "message": ("ObjectNotFoundException: For table 'job_note':"
                    " {'id': u'-32767'}")
    }


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
    assert resp.json == {"message": "No project with name foo"}


def test_create_note(webapp, eleven_jobs_processed, jm):
    """
    test creating a single note via endpoint
    """
    job = jm.get_job_list(0, 1)[0]
    resp = webapp.post_json(
        reverse("note-list", kwargs={"project": jm.project}),
        {
            "job_id": job["id"],
            "failure_classification_id": 2,
            "who": "kelly clarkson",
            "note": "you look like a man-o-lantern"
        }
    )

    assert resp.status_int == 200
    assert resp.json['message'] == 'note stored for job 1'

    note_list = jm.get_job_note_list(job_id=job["id"])
    del(note_list[0]["note_timestamp"])

    assert note_list[0] == {
        u'job_id': 1,
        u'who': u'kelly clarkson',
        u'failure_classification_id': 2,
        u'note': u'you look like a man-o-lantern',
        u'active_status': u'active',
        u'id': 1
    }


def test_objectstore_create(webapp, job_sample, jm):
    """
    test posting data to the objectstore via webtest.
    extected result are:
    - return code 200
    - return message successful
    - 1 job stored in the objectstore
    """

    resp = webapp.post_json(
        reverse('objectstore-list',
                kwargs={'project': jm.project}),
        params=job_sample
    )
    assert resp.status_int == 200
    assert resp.json['message'] == 'well-formed JSON stored'

    stored_objs = jm.get_os_dhub().execute(
        proc="objectstore_test.selects.row_by_guid",
        placeholders=[job_sample["job"]["job_guid"]]
    )

    assert len(stored_objs) == 1

    assert stored_objs[0]['job_guid'] == job_sample["job"]["job_guid"]


