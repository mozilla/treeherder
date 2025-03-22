import logging

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ParseError
from rest_framework.response import Response
from rest_framework.status import HTTP_404_NOT_FOUND

from treeherder.model.error_summary import (
    MemDBCache,
    cache_clean_error_line,
    get_cleaned_line,
)
from treeherder.model.models import Job, JobNote, Push, TextLogError

from .serializers import JobNoteDetailSerializer, JobNoteSerializer

logger = logging.getLogger(__name__)


class NoteViewSet(viewsets.ViewSet):
    """
    This viewset is responsible for the note endpoint.
    """

    def retrieve(self, request, project, pk=None):
        """
        GET method implementation for a note detail

        """
        try:
            serializer = JobNoteSerializer(JobNote.objects.get(id=pk))
            return Response(serializer.data)
        except JobNote.DoesNotExist:
            return Response(f"No note with id: {pk}", status=HTTP_404_NOT_FOUND)

    def list(self, request, project):
        """
        GET method implementation for list view
        job_id -- Mandatory filter indicating which job these notes belong to.
        """

        job_id = request.query_params.get("job_id")
        if not job_id:
            raise ParseError(detail="The job_id parameter is mandatory for this endpoint")
        try:
            job_id = int(job_id)
        except ValueError:
            raise ParseError(detail="The job_id parameter must be an integer")

        job = Job.objects.get(repository__name=project, id=job_id)
        serializer = JobNoteSerializer(JobNote.objects.filter(job=job), many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def push_notes(self, request, project):
        """
        GET method to get all classifications for a push revision with some
        job details
        :param request: Require `revision` as a SHA
        :param project: Repository of the revision
        :return:
        """
        revision = request.query_params.get("revision")
        if not revision:
            raise ParseError(detail="The revision parameter is mandatory for this endpoint")

        push = Push.objects.get(repository__name=project, revision=revision)
        notes = JobNote.objects.filter(job__push=push).select_related(
            "job", "job__push", "job__job_type", "job__taskcluster_metadata"
        )
        serializer = JobNoteDetailSerializer(notes, many=True)
        return Response(serializer.data)

    def create(self, request, project):
        """
        POST method implementation
        """
        current_job = Job.objects.get(repository__name=project, id=int(request.data["job_id"]))
        fc_id = int(request.data["failure_classification_id"])
        revision = current_job.push.revision
        JobNote.objects.create(
            job=current_job,
            failure_classification_id=fc_id,
            user=request.user,
            text=request.data.get("text", ""),
        )

        if fc_id == 2:  # this is for fixed_by_commit (backout | follow_up_commit)
            # remove cached failure line counts
            if current_job.repository == "comm-central":
                lcache = MemDBCache("cc_error_lines")
            else:
                lcache = MemDBCache("mc_error_lines")
            line_cache = lcache.get_cache()
            date = current_job.submit_time.date().isoformat()
            if line_cache and date in line_cache.keys():
                for err in TextLogError.objects.filter(job=current_job):
                    cache_clean_line = cache_clean_error_line(get_cleaned_line(err.line))

                    # TODO: if annotating a FBC and we don't have new_failure, or failure
                    # has already been annotated (cleaned), then we need to store new_failure
                    # in the tle.  Here we need to take all known failures that match ccl
                    # and annotate them as new_failure.  Theoretically these will
                    if cache_clean_line in line_cache[date].keys():
                        line_cache[date][cache_clean_line] -= 1
                        if line_cache[date][cache_clean_line] <= 0:
                            del line_cache[date][cache_clean_line]

                        if (
                            cache_clean_line in line_cache[date]["new_lines"].keys()
                            and revision
                            and line_cache[date]["new_lines"][cache_clean_line] == revision
                        ):
                            # delete both the "new_lines" reference and the existing reference
                            # this allows us to classify a future failure as new_failure!
                            del line_cache[date]["new_lines"][cache_clean_line]
                        try:
                            lcache.update_cache(date, line_cache[date])
                            lcache.update_db_cache(date, line_cache[date])
                        except Exception as e:
                            logger.error(
                                "error caching error_lines for job %s: %s",
                                current_job.id,
                                e,
                                exc_info=True,
                            )

        return Response({"message": "note stored for job {}".format(request.data["job_id"])})

    def destroy(self, request, project, pk=None):
        """
        Delete a note entry
        """
        try:
            note = JobNote.objects.get(id=pk)
            note.delete()
            return Response({"message": "Note deleted"})
        except JobNote.DoesNotExist:
            return Response(f"No note with id: {pk}", status=HTTP_404_NOT_FOUND)
