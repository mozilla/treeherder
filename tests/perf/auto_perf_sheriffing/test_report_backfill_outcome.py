# import logging
from datetime import datetime  # , timedelta

# from unittest.mock import MagicMock

# import pytest
from tests import settings as test_settings
from django.core.management import call_command

from treeherder.perf.auto_perf_sheriffing.sherlock import Sherlock

# from treeherder.perf.email import BackfillNotificationWriter
# from treeherder.perf.exceptions import MaxRuntimeExceeded

EPOCH = datetime.utcfromtimestamp(0)


def test_email_is_sent_after_successful_backfills(
    report_maintainer_mock,
    backfill_tool_mock,
    secretary,
    record_ready_for_processing,
    sherlock_settings,
    tc_notify_mock,
):
    sherlock = Sherlock(
        report_maintainer_mock,
        backfill_tool_mock,
        secretary,
    )
    sherlock.sheriff(
        since=EPOCH,
        frameworks=['test_talos'],
        repositories=[test_settings.TREEHERDER_TEST_REPOSITORY_NAME],
    )
    record_ready_for_processing.refresh_from_db()

    call_command('report_backfill_outcome')
    tc_notify_mock.email.assert_called_once()
    # assert tc_notify_mock.email.call_count == 1


# def test_email_is_still_sent_if_context_is_too_corrupt_to_be_actionable(
#     report_maintainer_mock,
#     backfill_tool_mock,
#     secretary,
#     record_ready_for_processing,
#     sherlock_settings,
#     notify_client_mock,
#     broken_context_str,
#     # Note: parametrizes the test
# ):
#     record_ready_for_processing.context = broken_context_str
#     record_ready_for_processing.save()
#
#     sherlock = Sherlock(
#         report_maintainer_mock,
#         backfill_tool_mock,
#         secretary,
#     )
#     sherlock.sheriff(
#         since=EPOCH,
#         frameworks=['test_talos'],
#         repositories=[test_settings.TREEHERDER_TEST_REPOSITORY_NAME],
#     )
#
#     # assert notify_client_mock.email.call_count == 1
#
#
# def test_no_email_is_sent_if_runtime_exceeded(
#     report_maintainer_mock,
#     backfill_tool_mock,
#     secretary,
#     record_ready_for_processing,
#     sherlock_settings,
#     notify_client_mock,
# ):
#     no_time_left = timedelta(seconds=0)
#
#     sherlock = Sherlock(report_maintainer_mock, backfill_tool_mock, secretary, no_time_left)
#     try:
#         sherlock.sheriff(since=EPOCH, frameworks=['raptor', 'talos'], repositories=['autoland'])
#     except MaxRuntimeExceeded:
#         pass
#
#     # assert notify_client_mock.email.call_count == 0
#
#
# @pytest.mark.parametrize(
#     'framework, repository',
#     [
#         ('non_existent_framework', test_settings.TREEHERDER_TEST_REPOSITORY_NAME),
#         ('test_talos', 'non_existent_repository'),
#         ('non_existent_framework', 'non_existent_repository'),
#     ],
# )
# def test_no_email_is_sent_for_untargeted_alerts(
#     report_maintainer_mock,
#     backfill_tool_mock,
#     secretary,
#     record_ready_for_processing,
#     sherlock_settings,
#     notify_client_mock,
#     framework,
#     repository,
# ):
#     sherlock = Sherlock(
#         report_maintainer_mock,
#         backfill_tool_mock,
#         secretary,
#     )
#     sherlock.sheriff(
#         since=EPOCH,
#         frameworks=[framework],
#         repositories=[repository],
#     )
#     record_ready_for_processing.refresh_from_db()
#
#     # assert notify_client_mock.email.call_count == 0
#
#
# def email_writer_mock():
#     return MagicMock(spec=BackfillNotificationWriter())
