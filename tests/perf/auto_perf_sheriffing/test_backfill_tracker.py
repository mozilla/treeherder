from datetime import datetime, timedelta
from itertools import count

import pytest
import responses

from tests.test_utils import create_generic_job
from treeherder.model.models import JobLog, TaskclusterMetadata
from treeherder.perf.auto_perf_sheriffing.backfill_tracker import BackfillTracker
from treeherder.perf.models import BackfilledPush, BackfillRequest

LIVE_LOG_URL = "https://logs.example.org/live_backing_log"


@pytest.fixture
def backfill_tracker():
    return BackfillTracker()


@pytest.fixture
def second_push(create_push, test_repository):
    return create_push(test_repository, revision="b" * 40)


@pytest.fixture
def third_push(create_push, test_repository):
    return create_push(test_repository, revision="c" * 40)


@pytest.fixture
def make_job(test_repository, generic_reference_data, failure_classifications):
    guids = (f"backfill-tracker-test-guid-{n}" for n in count(1))

    def _make(push, state="completed", result="success"):
        job = create_generic_job(next(guids), test_repository, push.id, generic_reference_data)
        job.state = state
        job.result = result
        job.save()
        return job

    return _make


@pytest.fixture
def make_task(make_job):
    """Create a job wired up with TaskclusterMetadata and, optionally, a live_backing_log."""

    def _make(
        push,
        task_id,
        state="completed",
        result="success",
        with_log=True,
        log_url=LIVE_LOG_URL,
    ):
        job = make_job(push, state=state, result=result)
        TaskclusterMetadata.objects.create(job=job, task_id=task_id, retry_id=0)
        if with_log:
            JobLog.objects.create(
                job=job, name="live_backing_log", url=log_url, status=JobLog.PARSED
            )
        return job

    return _make


@pytest.fixture
def backfill_request(test_push, test_repository):
    return BackfillRequest.objects.create(
        push=test_push, repository=test_repository, bk_task_id="r" * 22
    )


class TestSyncBackfillRequest:
    def test_marks_stale_request_as_failed(self, backfill_tracker, test_push, test_repository):
        request = BackfillRequest.objects.create(
            push=test_push, repository=test_repository, bk_task_id="b" * 22
        )
        BackfillRequest.objects.filter(pk=request.pk).update(
            created=datetime.now() - timedelta(days=4)
        )
        request.refresh_from_db()

        backfill_tracker._sync_backfill_request(request)

        assert request.status == BackfillRequest.FAILED

    def test_skips_when_bk_task_not_yet_ingested(
        self, backfill_tracker, test_push, test_repository
    ):
        request = BackfillRequest.objects.create(
            push=test_push, repository=test_repository, bk_task_id="b" * 22
        )

        backfill_tracker._sync_backfill_request(request)

        request.refresh_from_db()
        assert request.status == BackfillRequest.PENDING

    def test_skips_when_job_not_completed(
        self, backfill_tracker, test_push, test_repository, make_task
    ):
        task_id = "b" * 22
        make_task(test_push, task_id, state="running", result="unknown")
        request = BackfillRequest.objects.create(
            push=test_push, repository=test_repository, bk_task_id=task_id
        )

        backfill_tracker._sync_backfill_request(request)

        request.refresh_from_db()
        assert request.status == BackfillRequest.PENDING

    def test_fails_when_job_result_not_success(
        self, backfill_tracker, test_push, test_repository, make_task
    ):
        task_id = "b" * 22
        make_task(test_push, task_id, result="testfailed")
        request = BackfillRequest.objects.create(
            push=test_push, repository=test_repository, bk_task_id=task_id
        )

        backfill_tracker._sync_backfill_request(request)

        request.refresh_from_db()
        assert request.status == BackfillRequest.FAILED

    def test_fails_when_live_backing_log_missing(
        self, backfill_tracker, test_push, test_repository, make_task
    ):
        task_id = "b" * 22
        make_task(test_push, task_id, with_log=False)
        request = BackfillRequest.objects.create(
            push=test_push, repository=test_repository, bk_task_id=task_id
        )

        backfill_tracker._sync_backfill_request(request)

        request.refresh_from_db()
        assert request.status == BackfillRequest.FAILED

    @responses.activate
    def test_leaves_pending_when_log_fetch_fails(
        self, backfill_tracker, test_push, test_repository, make_task
    ):
        task_id = "b" * 22
        make_task(test_push, task_id)
        responses.add(responses.GET, LIVE_LOG_URL, status=500)
        request = BackfillRequest.objects.create(
            push=test_push, repository=test_repository, bk_task_id=task_id
        )

        backfill_tracker._sync_backfill_request(request)

        request.refresh_from_db()
        assert request.status == BackfillRequest.PENDING

    @responses.activate
    def test_fails_when_no_recognizable_line_in_log(
        self, backfill_tracker, test_push, test_repository, make_task
    ):
        task_id = "b" * 22
        make_task(test_push, task_id)
        responses.add(responses.GET, LIVE_LOG_URL, body="nothing interesting here\n", status=200)
        request = BackfillRequest.objects.create(
            push=test_push, repository=test_repository, bk_task_id=task_id
        )

        backfill_tracker._sync_backfill_request(request)

        request.refresh_from_db()
        assert request.status == BackfillRequest.FAILED

    @responses.activate
    def test_parses_new_format_and_creates_backfilled_push(
        self, backfill_tracker, test_push, second_push, test_repository, make_task, make_job
    ):
        task_id = "b" * 22
        make_task(test_push, task_id)

        decision_task_id = "d" * 22
        action_task_id = "a" * 22
        decision_job = make_job(second_push)
        TaskclusterMetadata.objects.create(job=decision_job, task_id=decision_task_id, retry_id=0)

        log = "\n".join(
            [
                'BACKFILL_STARTED: {"strategy": "sliced", "label": "test-label", '
                '"slices": 3, "target_pushes": [1, 2, 3], "scanned_push_count": 3}',
                f'BACKFILL_DATA: {{"decision_task_id": "{decision_task_id}"}}',
                f"Task seen here: https://tc.example.org/tasks/{action_task_id}",
                "",
            ]
        )
        responses.add(responses.GET, LIVE_LOG_URL, body=log, status=200)

        request = BackfillRequest.objects.create(
            push=test_push, repository=test_repository, bk_task_id=task_id
        )

        backfill_tracker._sync_backfill_request(request)

        request.refresh_from_db()
        assert request.status == BackfillRequest.SYNCED
        assert request.strategy == BackfillRequest.SLICED
        assert request.label == "test-label"
        assert request.slices == 3
        assert request.target_hg_push_ids == [1, 2, 3]
        assert request.scanned_push_count == 3

        backfilled = BackfilledPush.objects.get(backfill_request=request)
        assert backfilled.push_id == second_push.id
        assert backfilled.decision_task_id == decision_task_id
        assert backfilled.action_task_id == action_task_id
        assert backfilled.status == BackfilledPush.PENDING

    @responses.activate
    def test_skips_backfill_data_line_when_decision_task_not_found(
        self, backfill_tracker, test_push, test_repository, make_task
    ):
        task_id = "b" * 22
        make_task(test_push, task_id)

        log = "\n".join(
            [
                'BACKFILL_STARTED: {"strategy": "standard", "label": "l", '
                '"slices": 1, "target_pushes": [1], "scanned_push_count": 1}',
                f'BACKFILL_DATA: {{"decision_task_id": "{"z" * 22}"}}',
                "",
            ]
        )
        responses.add(responses.GET, LIVE_LOG_URL, body=log, status=200)
        request = BackfillRequest.objects.create(
            push=test_push, repository=test_repository, bk_task_id=task_id
        )

        backfill_tracker._sync_backfill_request(request)

        request.refresh_from_db()
        assert request.status == BackfillRequest.SYNCED
        assert BackfilledPush.objects.filter(backfill_request=request).count() == 0

    @responses.activate
    def test_marks_backfilled_push_failed_when_task_seen_here_missing(
        self, backfill_tracker, test_push, second_push, test_repository, make_task, make_job
    ):
        task_id = "b" * 22
        make_task(test_push, task_id)

        decision_task_id = "d" * 22
        decision_job = make_job(second_push)
        TaskclusterMetadata.objects.create(job=decision_job, task_id=decision_task_id, retry_id=0)

        # BACKFILL_DATA and "Task seen here:" should come in pairs; this log is
        # missing the "Task seen here:" line for the BACKFILL_DATA below.
        log = "\n".join(
            [
                'BACKFILL_STARTED: {"strategy": "standard", "label": "l", '
                '"slices": 1, "target_pushes": [1], "scanned_push_count": 1}',
                f'BACKFILL_DATA: {{"decision_task_id": "{decision_task_id}"}}',
                "",
            ]
        )
        responses.add(responses.GET, LIVE_LOG_URL, body=log, status=200)
        request = BackfillRequest.objects.create(
            push=test_push, repository=test_repository, bk_task_id=task_id
        )

        backfill_tracker._sync_backfill_request(request)

        backfilled = BackfilledPush.objects.get(backfill_request=request)
        assert backfilled.status == BackfilledPush.FAILED

    @responses.activate
    def test_marks_previous_backfilled_push_failed_when_next_data_line_starts(
        self,
        backfill_tracker,
        test_push,
        second_push,
        third_push,
        test_repository,
        make_task,
        make_job,
    ):
        task_id = "b" * 22
        make_task(test_push, task_id)

        decision_task_id_1 = "d" * 22
        decision_task_id_2 = "e" * 22
        action_task_id = "a" * 22
        # BackfilledPush rows are keyed on (backfill_request, push), so the two
        # BACKFILL_DATA lines must resolve to different pushes for get_or_create
        # to actually create two separate rows.
        job1 = make_job(second_push)
        job2 = make_job(third_push)
        TaskclusterMetadata.objects.create(job=job1, task_id=decision_task_id_1, retry_id=0)
        TaskclusterMetadata.objects.create(job=job2, task_id=decision_task_id_2, retry_id=0)

        log = "\n".join(
            [
                'BACKFILL_STARTED: {"strategy": "standard", "label": "l", '
                '"slices": 0, "target_pushes": [1, 2], "scanned_push_count": 2}',
                f'BACKFILL_DATA: {{"decision_task_id": "{decision_task_id_1}"}}',
                f'BACKFILL_DATA: {{"decision_task_id": "{decision_task_id_2}"}}',
                f"Task seen here: https://tc.example.org/tasks/{action_task_id}",
                "",
            ]
        )
        responses.add(responses.GET, LIVE_LOG_URL, body=log, status=200)
        request = BackfillRequest.objects.create(
            push=test_push, repository=test_repository, bk_task_id=task_id
        )

        backfill_tracker._sync_backfill_request(request)

        first = BackfilledPush.objects.get(
            backfill_request=request, decision_task_id=decision_task_id_1
        )
        second = BackfilledPush.objects.get(
            backfill_request=request, decision_task_id=decision_task_id_2
        )
        assert request.status == BackfillRequest.SYNCED
        assert first.status == BackfilledPush.FAILED
        assert second.status == BackfilledPush.PENDING
        assert second.action_task_id == action_task_id


class TestSyncBackfilledPush:
    def _make_backfilled_push(self, backfill_request, push, action_task_id=None):
        return BackfilledPush.objects.create(
            backfill_request=backfill_request,
            push=push,
            decision_task_id="d" * 22,
            action_task_id=action_task_id,
        )

    def test_marks_stale_push_as_failed(self, backfill_tracker, backfill_request, test_push):
        bp = self._make_backfilled_push(backfill_request, test_push, action_task_id="a" * 22)
        BackfilledPush.objects.filter(pk=bp.pk).update(created=datetime.now() - timedelta(days=4))
        bp.refresh_from_db()

        backfill_tracker._sync_backfilled_push(bp)

        assert bp.status == BackfilledPush.FAILED

    def test_skips_when_action_task_not_yet_ingested(
        self, backfill_tracker, backfill_request, test_push
    ):
        bp = self._make_backfilled_push(backfill_request, test_push, action_task_id="a" * 22)

        backfill_tracker._sync_backfilled_push(bp)

        bp.refresh_from_db()
        assert bp.status == BackfilledPush.PENDING

    def test_skips_when_job_not_completed(
        self, backfill_tracker, backfill_request, test_push, make_task
    ):
        action_task_id = "a" * 22
        make_task(test_push, action_task_id, state="running", result="unknown")
        bp = self._make_backfilled_push(backfill_request, test_push, action_task_id=action_task_id)

        backfill_tracker._sync_backfilled_push(bp)

        bp.refresh_from_db()
        assert bp.status == BackfilledPush.PENDING

    def test_fails_when_job_result_not_success(
        self, backfill_tracker, backfill_request, test_push, make_task
    ):
        action_task_id = "a" * 22
        make_task(test_push, action_task_id, result="testfailed")
        bp = self._make_backfilled_push(backfill_request, test_push, action_task_id=action_task_id)

        backfill_tracker._sync_backfilled_push(bp)

        bp.refresh_from_db()
        assert bp.status == BackfilledPush.FAILED

    def test_fails_when_live_backing_log_missing(
        self, backfill_tracker, backfill_request, test_push, make_task
    ):
        action_task_id = "a" * 22
        make_task(test_push, action_task_id, with_log=False)
        bp = self._make_backfilled_push(backfill_request, test_push, action_task_id=action_task_id)

        backfill_tracker._sync_backfilled_push(bp)

        bp.refresh_from_db()
        assert bp.status == BackfilledPush.FAILED

    @responses.activate
    def test_leaves_pending_when_log_fetch_fails(
        self, backfill_tracker, backfill_request, test_push, make_task
    ):
        action_task_id = "a" * 22
        make_task(test_push, action_task_id)
        responses.add(responses.GET, LIVE_LOG_URL, status=500)
        bp = self._make_backfilled_push(backfill_request, test_push, action_task_id=action_task_id)

        backfill_tracker._sync_backfilled_push(bp)

        bp.refresh_from_db()
        assert bp.status == BackfilledPush.PENDING

    @responses.activate
    def test_marks_created_when_backfilled_job_is_ingested(
        self, backfill_tracker, backfill_request, test_push, second_push, make_task, make_job
    ):
        backfill_request.label = "test-label"
        backfill_request.save()

        action_task_id = "a" * 22
        make_task(test_push, action_task_id)

        job_task_id = "j" * 22
        backfilled_job = make_job(second_push)
        TaskclusterMetadata.objects.create(job=backfilled_job, task_id=job_task_id, retry_id=0)

        log = f"Creating task with taskId {job_task_id} for test-label\n"
        responses.add(responses.GET, LIVE_LOG_URL, body=log, status=200)
        bp = self._make_backfilled_push(backfill_request, test_push, action_task_id=action_task_id)

        backfill_tracker._sync_backfilled_push(bp)

        bp.refresh_from_db()
        assert bp.status == BackfilledPush.CREATED
        assert bp.job_id == backfilled_job.id

    @responses.activate
    def test_stays_pending_when_backfilled_job_task_not_yet_ingested(
        self, backfill_tracker, backfill_request, test_push, make_task
    ):
        backfill_request.label = "test-label"
        backfill_request.save()

        action_task_id = "a" * 22
        make_task(test_push, action_task_id)

        log = f"Creating task with taskId {'j' * 22} for test-label\n"
        responses.add(responses.GET, LIVE_LOG_URL, body=log, status=200)
        bp = self._make_backfilled_push(backfill_request, test_push, action_task_id=action_task_id)

        backfill_tracker._sync_backfilled_push(bp)

        bp.refresh_from_db()
        # The referenced job task isn't ingested yet, so we stop processing the log
        # and leave the push PENDING for a later retry.
        assert bp.status == BackfilledPush.PENDING

    @responses.activate
    def test_skips_creating_task_line_when_label_mismatches(
        self, backfill_tracker, backfill_request, test_push, second_push, make_task, make_job
    ):
        backfill_request.label = "test-label"
        backfill_request.save()

        action_task_id = "a" * 22
        make_task(test_push, action_task_id)

        job_task_id = "j" * 22
        backfilled_job = make_job(second_push)
        TaskclusterMetadata.objects.create(job=backfilled_job, task_id=job_task_id, retry_id=0)

        log = f"Creating task with taskId {job_task_id} for other-label\n"
        responses.add(responses.GET, LIVE_LOG_URL, body=log, status=200)
        bp = self._make_backfilled_push(backfill_request, test_push, action_task_id=action_task_id)

        backfill_tracker._sync_backfilled_push(bp)

        bp.refresh_from_db()
        # The line's label doesn't match the request's label, so it's treated as
        # unrelated to this backfill and the push has no recognizable line to sync.
        assert bp.status == BackfilledPush.FAILED
        assert bp.job_id is None

    @responses.activate
    def test_marks_skipped_when_push_already_has_job(
        self, backfill_tracker, backfill_request, test_push, make_task
    ):
        action_task_id = "a" * 22
        make_task(test_push, action_task_id)

        log = f"Skipping push with decision task ID {'d' * 22}\n"
        responses.add(responses.GET, LIVE_LOG_URL, body=log, status=200)
        bp = self._make_backfilled_push(backfill_request, test_push, action_task_id=action_task_id)

        backfill_tracker._sync_backfilled_push(bp)

        bp.refresh_from_db()
        assert bp.status == BackfilledPush.SKIPPED

    @responses.activate
    def test_fails_when_no_recognizable_line_in_log(
        self, backfill_tracker, backfill_request, test_push, make_task
    ):
        action_task_id = "a" * 22
        make_task(test_push, action_task_id)
        responses.add(responses.GET, LIVE_LOG_URL, body="nothing here\n", status=200)
        bp = self._make_backfilled_push(backfill_request, test_push, action_task_id=action_task_id)

        backfill_tracker._sync_backfilled_push(bp)

        bp.refresh_from_db()
        assert bp.status == BackfilledPush.FAILED


class TestSyncWrapper:
    def test_sync_only_processes_pending_records(
        self, backfill_tracker, test_push, test_repository, monkeypatch
    ):
        synced_request_ids = []
        monkeypatch.setattr(
            backfill_tracker,
            "_sync_backfill_request",
            lambda r: synced_request_ids.append(r.id),
        )
        monkeypatch.setattr(backfill_tracker, "_sync_backfilled_push", lambda p: None)

        pending = BackfillRequest.objects.create(
            push=test_push, repository=test_repository, bk_task_id="p" * 22
        )
        BackfillRequest.objects.create(
            push=test_push,
            repository=test_repository,
            bk_task_id="s" * 22,
            status=BackfillRequest.SYNCED,
        )

        backfill_tracker.sync()

        assert synced_request_ids == [pending.id]

    def test_sync_backfill_requests_continues_after_one_raises(
        self, backfill_tracker, test_push, test_repository, monkeypatch
    ):
        r1 = BackfillRequest.objects.create(
            push=test_push, repository=test_repository, bk_task_id="1" * 22
        )
        r2 = BackfillRequest.objects.create(
            push=test_push, repository=test_repository, bk_task_id="2" * 22
        )

        processed = []

        def fake_sync(request):
            processed.append(request.id)
            if request.id == r1.id:
                raise RuntimeError("boom")

        monkeypatch.setattr(backfill_tracker, "_sync_backfill_request", fake_sync)

        backfill_tracker._sync_backfill_requests()

        assert set(processed) == {r1.id, r2.id}

    def test_sync_backfilled_pushes_continues_after_one_raises(
        self,
        backfill_tracker,
        backfill_request,
        test_push,
        create_push,
        test_repository,
        monkeypatch,
    ):
        test_push_2 = create_push(test_repository, revision="1" * 40)
        p1 = BackfilledPush.objects.create(
            backfill_request=backfill_request, push=test_push, decision_task_id="1" * 22
        )
        p2 = BackfilledPush.objects.create(
            backfill_request=backfill_request, push=test_push_2, decision_task_id="2" * 22
        )

        processed = []

        def fake_sync(push):
            processed.append(push.id)
            if push.id == p1.id:
                raise RuntimeError("boom")

        monkeypatch.setattr(backfill_tracker, "_sync_backfilled_push", fake_sync)

        backfill_tracker._sync_backfilled_pushes()

        assert set(processed) == {p1.id, p2.id}


class TestFailMissingActionTask:
    def test_marks_backfilled_push_failed(self, backfill_request, test_push):
        bp = BackfilledPush.objects.create(
            backfill_request=backfill_request, push=test_push, decision_task_id="d" * 22
        )

        BackfillTracker._fail_missing_action_task(bp)

        bp.refresh_from_db()
        assert bp.status == BackfilledPush.FAILED
