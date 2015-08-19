from django.core.management.base import BaseCommand

from mozillapulse.publishers import GenericPublisher
from mozillapulse.config import PulseConfiguration
from mozillapulse.messages.base import GenericMessage

from django.conf import settings


class Command(BaseCommand):

    """Management command to publish a job to a pulse exchange."""

    help = "Publish a message to a pulse exchange"

    def add_arguments(self, parser):
        parser.add_argument('project', help="The project/repo to post jobs for (e.g.: mozilla-inbound")
        parser.add_argument('payload_file', help="Path to the file that holds the job payload JSON")

    def handle(self, *args, **options):
        project = options["project"]
        payload_file = options["payload_file"]
        config = settings.PULSE_DATA_INGESTION_CONFIG
        user = config["userid"]
        password = config["password"]

        exchange = "exchange/{}/jobs".format(user)
        print "Publish to exchange: {}".format(exchange)

        config = PulseConfiguration(user=user, password=password,
                                    vhost=config['virtual_host'],
                                    ssl=config['ssl'],
                                    host=config['hostname'])

        message = JobMessage(project)
        with open(payload_file) as f:
            message.set_data("jobs", value=f.read())

        publisher = GenericPublisher(config, exchange=exchange)
        publisher.publish(message)


class JobMessage(GenericMessage):

    def __init__(self, project):
        super(JobMessage, self).__init__()
        self.routing_parts = [project]
