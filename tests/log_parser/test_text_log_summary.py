from django.core.management import call_command

from treeherder.model.models import (TextLogSummary,
                                     TextLogSummaryLine)

from ..autoclassify.utils import (create_failure_lines,
                                  test_line)


def test_remove_duplicates(test_job):
    summary = TextLogSummary.objects.create(job_guid="test",
                                            repository=test_job.repository)
    summary_1 = TextLogSummary.objects.create(job_guid="test1",
                                              repository=test_job.repository)

    lines = [(test_line, {}),
             (test_line, {"subtest": "subtest2"})]

    failure_lines = create_failure_lines(test_job, lines)

    duplicates = [TextLogSummaryLine.objects.create(summary=summary,
                                                    line_number=1,
                                                    failure_line=failure_lines[0]),
                  TextLogSummaryLine.objects.create(summary=summary,
                                                    line_number=1,
                                                    failure_line=failure_lines[0]),
                  TextLogSummaryLine.objects.create(summary=summary,
                                                    line_number=2,
                                                    failure_line=None),
                  TextLogSummaryLine.objects.create(summary=summary,
                                                    line_number=2,
                                                    failure_line=None)]

    non_dulicates = [TextLogSummaryLine.objects.create(summary=summary,
                                                       line_number=3,
                                                       failure_line=failure_lines[1]),
                     TextLogSummaryLine.objects.create(summary=summary,
                                                       line_number=4,
                                                       failure_line=None),
                     TextLogSummaryLine.objects.create(summary=summary_1,
                                                       line_number=2,
                                                       failure_line=None)]

    expected_remain = [duplicates[0], duplicates[2]] + non_dulicates

    call_command("remove_duplicate_summaries")

    remaining = TextLogSummaryLine.objects.all()
    assert set(remaining) == set(expected_remain)
