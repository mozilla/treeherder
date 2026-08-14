import json
import logging
import re
from datetime import timedelta

import requests
from django.utils import timezone

from treeherder.model.models import JobLog, TaskclusterMetadata
from treeherder.perf.models import BackfilledPush, BackfillRequest

logger = logging.getLogger(__name__)


class BackfillTracker:
    RE_BACKFILL_STARTED = re.compile(r".*?BACKFILL_STARTED:\s+({.*})")
    RE_BACKFILL_DATA = re.compile(r".*?BACKFILL_DATA:\s+({.*})")
    RE_TASK_SEEN_HERE = re.compile(r"Task seen here:\s*\S*?/tasks/([A-Za-z0-9_-]+)")
    RE_CREATING_TASK = re.compile(r"Creating task with taskId (\S+) for (\S+)")
    RE_SKIPPING_PUSH = re.compile(r"Skipping push with decision task ID (\S+)")

    def sync(self):
        self._sync_backfill_requests()
        self._sync_backfilled_pushes()

    def _sync_backfill_requests(self):
        pending_requests = BackfillRequest.objects.filter(status=BackfillRequest.PENDING)
        for request in pending_requests:
            try:
                self._sync_backfill_request(request)
            except Exception as ex:
                logger.warning(f"Failed to sync BackfillRequest {request.id}: {ex}")

    def _sync_backfilled_pushes(self):
        pending_pushes = BackfilledPush.objects.filter(status=BackfilledPush.PENDING)
        for backfilled_push in pending_pushes:
            try:
                self._sync_backfilled_push(backfilled_push)
            except Exception as ex:
                logger.warning(f"Failed to sync BackfilledPush {backfilled_push.id}: {ex}")

    def _sync_backfill_request(self, request: BackfillRequest):
        if request.created < timezone.now() - timedelta(days=3):
            logger.warning(
                f"BackfillRequest {request.id}: created time is older than 3 days, failed to sync."
            )
            request.status = BackfillRequest.FAILED
            request.save()
            return
        try:
            tc_metadata = TaskclusterMetadata.objects.get(task_id=request.bk_task_id)
        except TaskclusterMetadata.DoesNotExist:
            logger.info(
                f"BackfillRequest {request.id}: bk_task {request.bk_task_id} not yet ingested, skipping."
            )
            return

        job = tc_metadata.job
        if job.state != "completed":
            logger.info(f"BackfillRequest {request.id}: job {job.id} not yet completed, skipping.")
            return
        if job.result != "success":
            logger.warning(
                f"BackfillRequest {request.id}: job {job.id} result is {job.result}, failed to sync."
            )
            request.status = BackfillRequest.FAILED
            request.save()
            return

        try:
            job_log = job.job_log.get(name="live_backing_log")
        except JobLog.DoesNotExist:
            logger.warning(
                f"BackfillRequest {request.id}: live_backing_log not found for job {job.id}, failed to sync."
            )
            request.status = BackfillRequest.FAILED
            request.save()
            return

        try:
            response = requests.get(job_log.url, timeout=30)
            response.raise_for_status()
        except requests.RequestException as ex:
            logger.warning(
                f"BackfillRequest {request.id}: Failed to fetch log from {job_log.url}: {ex}"
            )
            return

        is_parsed = False
        last_backfilled_push = None
        for line in response.text.splitlines():
            if "BACKFILL_STARTED:" in line:
                match = self.RE_BACKFILL_STARTED.match(line)
                if not match:
                    continue
                try:
                    entry = json.loads(match.group(1))
                except json.JSONDecodeError as ex:
                    logger.warning(
                        f"BackfillRequest {request.id}: Failed to parse BACKFILL_STARTED line: {ex}"
                    )
                    continue

                is_parsed = True
                entry_strategy = entry.get("strategy")
                if entry_strategy == "standard":
                    strategy = BackfillRequest.STANDARD
                elif entry_strategy == "sliced":
                    strategy = BackfillRequest.SLICED
                else:
                    logger.warning(
                        f"BackfillRequest {request.id}: Unknown strategy: {entry_strategy}."
                    )
                    strategy = None
                request.label = entry["label"]
                request.strategy = strategy
                request.slices = entry["slices"]
                request.target_hg_push_ids = entry["target_pushes"]
                request.scanned_push_count = entry["scanned_push_count"]
            elif "BACKFILL_DATA:" in line:
                match = self.RE_BACKFILL_DATA.match(line)
                if not match:
                    continue
                try:
                    entry = json.loads(match.group(1))
                except json.JSONDecodeError as ex:
                    logger.warning(
                        f"BackfillRequest {request.id}: Failed to parse BACKFILL_DATA line: {ex}"
                    )
                    continue

                decision_task_id = entry["decision_task_id"]
                try:
                    push_id = TaskclusterMetadata.objects.get(task_id=decision_task_id).job.push_id
                except TaskclusterMetadata.DoesNotExist:
                    # decision task should already be ingested since it was created before the backfill
                    logger.warning(
                        f"BackfillRequest {request.id}: decision task {decision_task_id} does not exist, skipping line."
                    )
                    continue

                if last_backfilled_push is not None:
                    self._fail_missing_action_task(last_backfilled_push)

                last_backfilled_push, _ = BackfilledPush.objects.get_or_create(
                    backfill_request=request,
                    push_id=push_id,
                    defaults={"decision_task_id": decision_task_id},
                )
            elif "Task seen here:" in line:
                if last_backfilled_push is None:
                    logger.warning(
                        f"BackfillRequest {request.id}: Task seen here: line found without a "
                        "preceding BACKFILL_DATA line, skipping."
                    )
                    continue

                match = self.RE_TASK_SEEN_HERE.search(line)
                action_task_id = match.group(1) if match else None
                if action_task_id:
                    last_backfilled_push.action_task_id = action_task_id
                    last_backfilled_push.save()
                last_backfilled_push = None

        if last_backfilled_push is not None:
            self._fail_missing_action_task(last_backfilled_push)

        if not is_parsed:
            logger.warning(
                f"BackfillRequest {request.id}: no matching line found in log, failed to sync."
            )
            request.status = BackfillRequest.FAILED
            request.save()
            return

        request.status = BackfillRequest.SYNCED
        request.save()

    @staticmethod
    def _fail_missing_action_task(backfilled_push: BackfilledPush):
        logger.warning(
            f"BackfillRequest {backfilled_push.backfill_request_id}: Task seen here: line missing "
            f"for BackfilledPush {backfilled_push.id}, failed to sync."
        )
        backfilled_push.status = BackfilledPush.FAILED
        backfilled_push.save()

    def _sync_backfilled_push(self, backfilled_push: BackfilledPush):
        if backfilled_push.created < timezone.now() - timedelta(days=3):
            logger.warning(
                f"BackfilledPush {backfilled_push.id}: created time is older than 3 days, failed to sync."
            )
            backfilled_push.status = BackfilledPush.FAILED
            backfilled_push.save()
            return
        try:
            tc_metadata = TaskclusterMetadata.objects.get(task_id=backfilled_push.action_task_id)
        except TaskclusterMetadata.DoesNotExist:
            logger.info(
                f"BackfilledPush {backfilled_push.id}: action_task {backfilled_push.action_task_id} "
                "not yet ingested, skipping."
            )
            return

        job = tc_metadata.job
        if job.state != "completed":
            logger.info(
                f"BackfilledPush {backfilled_push.id}: job {job.id} not yet completed, skipping."
            )
            return
        if job.result != "success":
            logger.warning(
                f"BackfilledPush {backfilled_push.id}: job {job.id} result is {job.result}, failed to sync."
            )
            backfilled_push.status = BackfilledPush.FAILED
            backfilled_push.save()
            return

        try:
            job_log = job.job_log.get(name="live_backing_log")
        except JobLog.DoesNotExist:
            logger.warning(
                f"BackfilledPush {backfilled_push.id}: live_backing_log not found for job {job.id}, skipping."
            )
            backfilled_push.status = BackfilledPush.FAILED
            backfilled_push.save()
            return

        try:
            response = requests.get(job_log.url, timeout=30)
            response.raise_for_status()
        except requests.RequestException as ex:
            logger.warning(
                f"BackfilledPush {backfilled_push.id}: Failed to fetch log from {job_log.url}: {ex}"
            )
            return

        for line in response.text.splitlines():
            if "Creating task with taskId" in line:
                match = self.RE_CREATING_TASK.search(line)
                job_task_id = match.group(1) if match else None
                if not job_task_id:
                    continue
                label = match.group(2) if match else None
                backfilled_label = backfilled_push.backfill_request.label
                if not label or label != backfilled_label:
                    logger.info(
                        f"BackfilledPush {backfilled_push.id}: label mismatch, got {label!r}, "
                        f"expected {backfilled_label!r}, skipping line."
                    )
                    continue
                try:
                    backfilled_job = TaskclusterMetadata.objects.get(task_id=job_task_id).job
                except TaskclusterMetadata.DoesNotExist:
                    logger.info(
                        f"BackfilledPush {backfilled_push.id}: backfilled job task {job_task_id} "
                        "not yet ingested, skipping line."
                    )
                    break
                backfilled_push.job = backfilled_job
                backfilled_push.status = BackfilledPush.CREATED
                break
            elif "Skipping push with decision task ID" in line:
                backfilled_push.status = BackfilledPush.SKIPPED
                break
        else:
            logger.warning(
                f"BackfilledPush {backfilled_push.id}: no matching line found in log, failed to sync."
            )
            backfilled_push.status = BackfilledPush.FAILED
            backfilled_push.save()
            return

        backfilled_push.save()
