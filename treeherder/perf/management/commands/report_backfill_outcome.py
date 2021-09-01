import logging
from django.core.management.base import BaseCommand


from treeherder.perf.models import BackfillNotificationRecord
from treeherder.perf.email import BackfillNotificationWriter
from treeherder.services.taskcluster import notify_client_factory

SUCCESS_STATUS = 200
logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        'Command used for reporting the outcome of the automatic backfilling process once per day.'
    )

    def handle(self, *args, **options):
        logger.info("Sherlock Notify Service: Notifying backfill outcome...")
        notify = notify_client_factory()
        email_writer = BackfillNotificationWriter()

        backfills_to_email = BackfillNotificationRecord.objects.all()
        backfilled_records = [backfill.record for backfill in backfills_to_email]
        if backfilled_records:
            backfill_notification = email_writer.prepare_new_email(backfilled_records)
            logger.debug(
                f"Sherlock Notify Service: Composed email notification payload `{backfill_notification}`."
            )
            # send email
            notification_outcome = notify.email(backfill_notification)
            logger.debug(
                f"Sherlock Notify Service: Email notification service replied with `{notification_outcome}`."
            )
            if notification_outcome['response'].status_code == SUCCESS_STATUS:
                logger.debug(
                    "Sherlock Notify Service: Removing notified records from helper table."
                )
                for record in backfills_to_email:
                    record.delete()
            else:
                logger.debug("Sherlock Notify Service: Email notification service failed.")
        else:
            logger.info("Sherlock Notify Service: Nothing to report via email.")
