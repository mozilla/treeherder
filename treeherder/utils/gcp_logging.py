"""GCP-structured logging handler that stamps log-context labels onto records.

This module imports ``google-cloud-logging`` and is only referenced from the
Django ``LOGGING`` config when structured logging is enabled, so environments
without the dependency (or with the feature turned off) never import it.
"""

from google.cloud.logging_v2.handlers import StructuredLogHandler

from treeherder.utils.logging_context import apply_context_labels


class ContextLabelStructuredLogHandler(StructuredLogHandler):
    """Emit GCP-structured logs with the active ``log_context`` labels attached.

    Labels are applied in ``handle`` — before the handler's filter phase — so
    google-cloud-logging's built-in ``CloudLoggingFilter`` reads ``record.labels``
    and emits them under ``logging.googleapis.com/labels`` (queryable in Cloud
    Logging). Applying them later (e.g. via a handler-level filter or in
    ``emit``) is too late: ``CloudLoggingFilter`` has already run.
    """

    def handle(self, record):
        apply_context_labels(record)
        return super().handle(record)
