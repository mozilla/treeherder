# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import os

from optparse import make_option
from django.core.management.base import BaseCommand
from treeherder.etl.pulse import TreeherderPulseDataAdapter, TreeherderPulseDaemon


class Command(BaseCommand):
    """Management command to run mozilla pulse consumer."""

    help = (
        "Manages mozilla pulse consumer daemon to listen for product build "
        "and test data events.\n\n"
        "Example: Write job data structures to stdout\n"
        "manage.py start_pulse_consumer --start --outfile 'stdout'"
    )

    option_list = BaseCommand.option_list + (

        make_option('--start',
                    action='store_true',
                    dest='start',
                    help="Start the daemon."),

        make_option('--stop',
                    action='store_true',
                    dest='stop',
                    help=("Stop the daemon. If no pidfile is supplied "
                          "pulse_consumer.pid is used.")),

        make_option('--restart',
                    action='store_true',
                    dest='restart',
                    help="Restart the daemon."),

        make_option('--daemon',
                    action='store_true',
                    dest='daemon',
                    help='Run as daemon (posix only). Requires sudo.'),

        make_option('--pidfile',
                    action='store_true',
                    dest='pidfile',
                    default='{0}/pulse_consumer.pid'.format(os.getcwd()),
                    help='Path to file for loggin pid.'),

        make_option('--durable',
                    action='store_true',
                    dest='durable',
                    help=("Should only be used in production. Causes pulse "
                          "to store data for consumer when disconnected.")),

        make_option('--logdir',
                    action='store',
                    dest='logdir',
                    help=("Directory to write log files to.")),

        make_option('--rawdata',
                    action='store_true',
                    dest='rawdata',
                    help=("Log the raw data and also write it to the "
                          "outfile if one is specified.")),

        make_option('--outfile',
                    action='store',
                    dest='outfile',
                    help=("Write treeherder json data to file specified in"
                          " outfile, quick way to test data structures. Use"
                          " the string stdout to write to standard output.")),
    )

    def handle(self, *args, **options):

        start = options.get("start")
        restart = options.get("restart")
        stop = options.get("stop")
        daemon = options.get("daemon")
        pidfile = options.get("pidfile")
        durable = options.get("durable")
        logdir = options.get("logdir")
        rawdata = options.get("rawdata")
        outfile = options.get("outfile")

        tda = TreeherderPulseDataAdapter(
            durable=durable,
            logdir=logdir,
            rawdata=rawdata,
            outfile=outfile,
            loaddata=True
        )

        if start:

            if daemon:

                th_daemon = TreeherderPulseDaemon(
                    pidfile, treeherder_data_adapter=tda, stdin='/dev/null',
                    stdout='/dev/null', stderr='/dev/null'
                )

                th_daemon.start()

            else:
                #Run the pulse consumer without becoming
                #a daemon
                tda.start()

        else:

            th_daemon = TreeherderPulseDaemon(
                pidfile, treeherder_data_adapter=tda, stdin='/dev/null',
                stdout='/dev/null', stderr='/dev/null'
            )

            if restart:
                th_daemon.restart()
            elif stop:
                th_daemon.stop()
