import pytest

from treeherder.perf.email import DeletionNotificationWriter, DeletionReportContent


class TestDeletionReportContent:
    def test_error_out_when_trying_to_serialize_empty_content(self):
        content = DeletionReportContent()

        with pytest.raises(ValueError, match="No content set"):
            _ = str(content)


class TestDeletionNotificationWriter:
    def test_email_content(self, test_perf_signature):
        email_writer = DeletionNotificationWriter()
        email_writer.prepare_new_email(test_perf_signature)

        expected_content = self.__prepare_expected_content(test_perf_signature)
        assert expected_content == email_writer.email["content"]

    def test_writing_content_without_mentioning_any_signature_doesnt_error_out(self):
        email_writer = DeletionNotificationWriter()

        try:
            email_writer.prepare_new_email([])
        except ValueError as ex:
            if str(ex) == "No content set":
                pytest.fail(
                    "DeletionNotificationWriter must be able to provide a default content, "
                    "even if there's nothing to mention."
                )
            raise ex  # unexpected programming error

    @staticmethod
    def __prepare_expected_content(test_perf_signature):
        expected_content = "".join(
            (
                DeletionReportContent.DESCRIPTION,
                DeletionReportContent.TABLE_HEADERS,
                "| ",
                " | ".join(
                    (
                        test_perf_signature.repository.name,
                        test_perf_signature.framework.name,
                        test_perf_signature.platform.platform,
                        test_perf_signature.suite,
                        test_perf_signature.application,
                        str(test_perf_signature.last_updated.date()),
                    )
                ),
                " |\n",
            )
        )
        return expected_content
