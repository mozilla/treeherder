import datetime
import logging

import newrelic.agent
from cache_memoize import cache_memoize
from django.contrib.postgres.search import SearchQuery
from django.db.models import Exists, OuterRef, Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.status import HTTP_400_BAD_REQUEST, HTTP_404_NOT_FOUND

from treeherder.log_parser.failureline import get_group_results
from treeherder.model.models import Commit, Job, JobType, Push, Repository
from treeherder.push_health.builds import get_build_failures
from treeherder.push_health.compare import get_commit_history
from treeherder.push_health.linting import get_lint_failures
from treeherder.push_health.tests import (
    get_test_failure_jobs,
    get_test_failures,
    get_test_in_progress_count,
)
from treeherder.push_health.usage import get_usage
from treeherder.webapp.api.serializers import PushSerializer
from treeherder.webapp.api.utils import to_datetime, to_timestamp

logger = logging.getLogger(__name__)


class PushViewSet(viewsets.ViewSet):
    """
    View for ``push`` records
    """

    def list(self, request, project):
        """
        GET method for list of ``push`` records with revisions
        """
        # What is the upper limit on the number of pushes returned by the api
        max_push_count = 1000

        # make a mutable copy of these params
        filter_params = request.query_params.copy()

        # This will contain some meta data about the request and results
        meta = {}
        # support ranges for date as well as revisions(changes) like old tbpl
        for param in [
            "fromchange",
            "tochange",
            "startdate",
            "enddate",
            "revision",
            "commit_revision",
        ]:
            v = filter_params.get(param, None)
            if v:
                del filter_params[param]
                meta[param] = v

        all_repos = request.query_params.get("all_repos")

        pushes = Push.objects.order_by("-time")
        if not all_repos:
            try:
                repository = Repository.objects.get(name=project)
            except Repository.DoesNotExist:
                return Response(
                    {"detail": f"No project with name {project}"}, status=HTTP_404_NOT_FOUND
                )

            pushes = pushes.filter(repository=repository)

        search_param = filter_params.get("search")
        if search_param:
            repository = Repository.objects.get(name=project)
            # Subquery to check if a commit exists with the search term
            commit_exists_subquery = Commit.objects.filter(
                push_id=OuterRef("id"), search_vector=SearchQuery(search_param)
            ).values("id")
            pushes = (
                Push.objects.annotate(has_matching_commit=Exists(commit_exists_subquery))
                .filter(
                    Q(repository=repository)
                    & (
                        Q(has_matching_commit=True)
                        | Q(author__icontains=search_param)
                        | Q(revision__icontains=search_param)
                    )
                )
                .distinct()
                .order_by("-time")[:200]
            )  # Get most recent results and limit result to 200
            print(pushes.query)
        for param, value in meta.items():
            if param == "fromchange":
                revision_field = "revision__startswith" if len(value) < 40 else "revision"
                filter_kwargs = {revision_field: value, "repository": repository}
                frompush_time = Push.objects.values_list("time", flat=True).get(**filter_kwargs)
                pushes = pushes.filter(time__gte=frompush_time)
                filter_params.update({"push_timestamp__gte": to_timestamp(frompush_time)})
                self.report_if_short_revision(param, value)

            elif param == "tochange":
                revision_field = "revision__startswith" if len(value) < 40 else "revision"
                filter_kwargs = {revision_field: value, "repository": repository}
                topush_time = Push.objects.values_list("time", flat=True).get(**filter_kwargs)
                pushes = pushes.filter(time__lte=topush_time)
                filter_params.update({"push_timestamp__lte": to_timestamp(topush_time)})
                self.report_if_short_revision(param, value)

            elif param == "startdate":
                pushes = pushes.filter(time__gte=to_datetime(value))
                filter_params.update({"push_timestamp__gte": to_timestamp(to_datetime(value))})
            elif param == "enddate":
                real_end_date = to_datetime(value) + datetime.timedelta(days=1)
                pushes = pushes.filter(time__lte=real_end_date)
                filter_params.update({"push_timestamp__lt": to_timestamp(real_end_date)})
            elif param == "revision":
                # revision must be the tip revision of the push itself
                revision_field = "revision__startswith" if len(value) < 40 else "revision"
                filter_kwargs = {revision_field: value}
                pushes = pushes.filter(**filter_kwargs)
                rev_key = (
                    "revisions_long_revision"
                    if len(meta["revision"]) == 40
                    else "revisions_short_revision"
                )
                filter_params.update({rev_key: meta["revision"]})
                self.report_if_short_revision(param, value)
            elif param == "commit_revision":
                # revision can be either the revision of the push itself, or
                # any of the commits it refers to
                pushes = pushes.filter(commits__revision=value)
                self.report_if_short_revision(param, value)

        for param in [
            "push_timestamp__lt",
            "push_timestamp__lte",
            "push_timestamp__gt",
            "push_timestamp__gte",
        ]:
            if filter_params.get(param):
                # translate push timestamp directly into a filter
                try:
                    value = datetime.datetime.fromtimestamp(float(filter_params.get(param)))
                except ValueError:
                    return Response(
                        {"detail": f"Invalid timestamp specified for {param}"},
                        status=HTTP_400_BAD_REQUEST,
                    )
                pushes = pushes.filter(**{param.replace("push_timestamp", "time"): value})

        for param in ["id__lt", "id__lte", "id__gt", "id__gte", "id"]:
            try:
                value = int(filter_params.get(param, 0))
            except ValueError:
                return Response(
                    {"detail": f"Invalid timestamp specified for {param}"},
                    status=HTTP_400_BAD_REQUEST,
                )
            if value:
                pushes = pushes.filter(**{param: value})

        id_in = filter_params.get("id__in")
        if id_in:
            try:
                id_in_list = [int(id) for id in id_in.split(",")]
            except ValueError:
                return Response(
                    {"detail": "Invalid id__in specification"}, status=HTTP_400_BAD_REQUEST
                )
            pushes = pushes.filter(id__in=id_in_list)

        author = filter_params.get("author")
        if author:
            if author.startswith("-"):
                author = author[1::]
                pushes = pushes.exclude(author__iexact=author)
            else:
                pushes = pushes.filter(author__iexact=author)

        author_contains = filter_params.get("author_contains")
        if author_contains:
            pushes = pushes.filter(author__icontains=author_contains)

        if filter_params.get("hide_reviewbot_pushes") == "true":
            pushes = pushes.exclude(author="reviewbot")

        try:
            count = int(filter_params.get("count", 10))
        except ValueError:
            return Response({"detail": "Valid count value required"}, status=HTTP_400_BAD_REQUEST)

        if count > max_push_count:
            msg = f"Specified count exceeds api limit: {max_push_count}"
            return Response({"detail": msg}, status=HTTP_400_BAD_REQUEST)

        if count < 1:
            msg = f"count requires a positive integer, not: {count}"
            return Response({"detail": msg}, status=HTTP_400_BAD_REQUEST)

        # we used to have a "full" parameter for this endpoint so you could
        # specify to not fetch the revision information if it was set to
        # false. however AFAIK no one ever used it (default was to fetch
        # everything), so let's just leave it out. it doesn't break
        # anything to send extra data when not required.
        pushes = pushes.select_related("repository").prefetch_related("commits")[:count]
        serializer = PushSerializer(pushes, many=True)

        meta["count"] = len(pushes)
        meta["repository"] = "all" if all_repos else project
        meta["filter_params"] = filter_params

        resp = {"meta": meta, "results": serializer.data}

        return Response(resp)

    def retrieve(self, request, project, pk=None):
        """
        GET method implementation for detail view of ``push``
        """
        try:
            push = Push.objects.get(repository__name=project, id=pk)
            serializer = PushSerializer(push)
            return Response(serializer.data)
        except Push.DoesNotExist:
            return Response(f"No push with id: {pk}", status=HTTP_404_NOT_FOUND)

    @action(detail=True)
    def status(self, request, project, pk=None):
        """
        Return a count of the jobs belonging to this push
        grouped by job status.
        """
        try:
            push = Push.objects.get(id=pk)
        except Push.DoesNotExist:
            return Response(f"No push with id: {pk}", status=HTTP_404_NOT_FOUND)
        return Response(push.get_status())

    @action(detail=False)
    def health_summary(self, request, project):
        """
        Return a calculated summary of the health of this push.
        """
        revision = request.query_params.get("revision")
        author = request.query_params.get("author")
        count = request.query_params.get("count")
        all_repos = request.query_params.get("all_repos")
        with_history = request.query_params.get("with_history")
        with_in_progress_tests = request.query_params.get("with_in_progress_tests", False)

        if revision:
            try:
                pushes = Push.objects.filter(
                    revision__in=revision.split(","), repository__name=project
                )
            except Push.DoesNotExist:
                return Response(f"No push with revision: {revision}", status=HTTP_404_NOT_FOUND)
        else:
            try:
                pushes = (
                    Push.objects.filter(author=author)
                    .select_related("repository")
                    .prefetch_related("commits")
                    .order_by("-time")
                )

                if not all_repos:
                    pushes = pushes.filter(repository__name=project)

                pushes = pushes[: int(count)]

            except Push.DoesNotExist:
                return Response(f"No pushes found for author: {author}", status=HTTP_404_NOT_FOUND)

        data = []
        commit_history = None

        for push in list(pushes):
            result_status, jobs = get_test_failure_jobs(push)

            test_result, push_health_test_failures = get_test_failures(
                push,
                jobs,
                result_status,
            )

            build_result, push_health_build_failures, builds_in_progress_count = get_build_failures(
                push
            )

            lint_result, push_health_lint_failures, linting_in_progress_count = get_lint_failures(
                push
            )

            test_failure_count = len(push_health_test_failures["needInvestigation"])
            build_failure_count = len(push_health_build_failures)
            lint_failure_count = len(push_health_lint_failures)
            test_in_progress_count = 0

            status = push.get_status()
            total_failures = test_failure_count + build_failure_count + lint_failure_count
            # Override the testfailed value added in push.get_status so that it aligns with how we detect lint, build and test failures
            # for the push health API's (total_failures doesn't include known intermittent failures)
            status["testfailed"] = total_failures

            if with_history:
                serializer = PushSerializer([push], many=True)
                commit_history = serializer.data
            if with_in_progress_tests:
                test_in_progress_count = get_test_in_progress_count(push)

            data.append(
                {
                    "revision": push.revision,
                    "repository": push.repository.name,
                    "testFailureCount": test_failure_count,
                    "testInProgressCount": test_in_progress_count,
                    "buildFailureCount": build_failure_count,
                    "buildInProgressCount": builds_in_progress_count,
                    "lintFailureCount": lint_failure_count,
                    "lintingInProgressCount": linting_in_progress_count,
                    "needInvestigation": test_failure_count
                    + build_failure_count
                    + lint_failure_count,
                    "status": status,
                    "history": commit_history,
                    "metrics": {
                        "linting": {
                            "name": "Linting",
                            "result": lint_result,
                        },
                        "tests": {
                            "name": "Tests",
                            "result": test_result,
                        },
                        "builds": {
                            "name": "Builds",
                            "result": build_result,
                        },
                    },
                }
            )

        return Response(data)

    @action(detail=False)
    def health_usage(self, request, project):
        usage = get_usage()
        return Response({"usage": usage})

    @action(detail=False)
    def health(self, request, project):
        """
        Return a calculated assessment of the health of this push.
        """
        revision = request.query_params.get("revision")

        try:
            repository = Repository.objects.get(name=project)
            push = Push.objects.get(revision=revision, repository=repository)
        except Push.DoesNotExist:
            return Response(f"No push with revision: {revision}", status=HTTP_404_NOT_FOUND)

        commit_history_details = None
        result_status, jobs = get_test_failure_jobs(push)
        # Parent compare only supported for Hg at this time.
        # Bug https://bugzilla.mozilla.org/show_bug.cgi?id=1612645
        if repository.dvcs_type == "hg":
            commit_history_details = get_commit_history(repository, revision, push)

        test_result, push_health_test_failures = get_test_failures(
            push,
            jobs,
            result_status,
        )

        build_result, build_failures, _unused = get_build_failures(push)

        lint_result, lint_failures, _unused = get_lint_failures(push)

        push_result = "pass"
        for metric_result in [test_result, lint_result, build_result]:
            if (
                metric_result == "indeterminate"
                or metric_result == "unknown"
                and push_result != "fail"
            ):
                push_result = metric_result
            elif metric_result == "fail":
                push_result = metric_result

        status = push.get_status()
        total_failures = (
            len(push_health_test_failures["needInvestigation"])
            + len(build_failures)
            + len(lint_failures)
        )
        # Override the testfailed value added in push.get_status so that it aligns with how we detect lint, build and test failures
        # for the push health API's (total_failures doesn't include known intermittent failures)
        status["testfailed"] = total_failures

        newrelic.agent.record_custom_event(
            "push_health_need_investigation",
            {
                "revision": revision,
                "repo": repository.name,
                "needInvestigation": len(push_health_test_failures["needInvestigation"]),
                "author": push.author,
            },
        )

        return Response(
            {
                "revision": revision,
                "id": push.id,
                "result": push_result,
                "jobs": jobs,
                "metrics": {
                    "commitHistory": {
                        "name": "Commit History",
                        "result": "none",
                        "details": commit_history_details,
                    },
                    "linting": {
                        "name": "Linting",
                        "result": lint_result,
                        "details": lint_failures,
                    },
                    "tests": {
                        "name": "Tests",
                        "result": test_result,
                        "details": push_health_test_failures,
                    },
                    "builds": {
                        "name": "Builds",
                        "result": build_result,
                        "details": build_failures,
                    },
                },
                "status": status,
            }
        )

    @cache_memoize(60 * 60)
    def get_decision_jobs(self, push_ids):
        job_types = JobType.objects.filter(name__endswith="Decision Task", symbol="D")
        return Job.objects.filter(
            push_id__in=push_ids,
            job_type__in=job_types,
            result="success",
        ).select_related("taskcluster_metadata")

    @action(detail=False)
    def decisiontask(self, request, project):
        """
        Return the decision task ids for the pushes.
        """
        push_ids = self.request.query_params.get("push_ids", "").split(",")
        decision_jobs = self.get_decision_jobs(push_ids)

        if decision_jobs:
            return Response(
                {
                    job.push_id: {
                        "id": job.taskcluster_metadata.task_id,
                        "run": job.guid.split("/")[1],
                    }
                    for job in decision_jobs
                }
            )
        logger.error(f"/decisiontask/ found no decision jobs for {push_ids}")
        self.get_decision_jobs.invalidate(push_ids)
        return Response(
            f"No decision tasks found for pushes: {push_ids}", status=HTTP_404_NOT_FOUND
        )

    # TODO: Remove when we no longer support short revisions: Bug 1306707
    def report_if_short_revision(self, param, revision):
        if len(revision) < 40:
            newrelic.agent.record_custom_event(
                "short_revision_push_api",
                {"error": "Revision <40 chars", "param": param, "revision": revision},
            )

    @action(detail=False)
    def group_results(self, request, project):
        """
        Return the results of all the test groups for this push.
        """
        revision = request.query_params.get("revision")

        try:
            repository = Repository.objects.get(name=project)
            push = Push.objects.get(revision=revision, repository=repository)
        except Push.DoesNotExist:
            return Response(f"No push with revision: {revision}", status=HTTP_404_NOT_FOUND)
        groups = get_group_results(repository, push)

        return Response(groups)
