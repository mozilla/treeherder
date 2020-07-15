# encoding: utf-8
#
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
#
# Contact: Kyle Lahnakoski (kyle@lahnakoski.com)
#
from __future__ import absolute_import, division, unicode_literals

import time

import requests
from boto import utils as boto_utils

from mo_dots import coalesce, to_data, dict_to_data
from mo_logs import Log, machine_metadata
from mo_logs.exceptions import Except, suppress_exception
from mo_threads import Thread, Till
from mo_times import timer
from mo_times.durations import Duration


def capture_termination_signal(please_stop):
    """
    WILL SIGNAL please_stop WHEN THIS AWS INSTANCE IS DUE FOR SHUTDOWN
    """
    def worker(please_stop):
        seen_problem = False
        while not please_stop:
            request_time = (time.time() - timer.START)/60  # MINUTES
            try:
                response = requests.get("http://169.254.169.254/latest/meta-data/spot/termination-time")
                seen_problem = False
                if response.status_code not in [400, 404]:
                    Log.alert("Shutdown AWS Spot Node {{name}} {{type}}", name=machine_metadata.name, type=machine_metadata.aws_instance_type)
                    please_stop.go()
            except Exception as e:
                e = Except.wrap(e)
                if "Failed to establish a new connection: [Errno 10060]" in e or "A socket operation was attempted to an unreachable network" in e:
                    Log.note("AWS Spot Detection has shutdown, this is probably not a spot node, (http://169.254.169.254 is unreachable)")
                    return
                elif seen_problem:
                    # IGNORE THE FIRST PROBLEM
                    Log.warning("AWS shutdown detection has more than one consecutive problem: (last request {{time|round(1)}} minutes since startup)", time=request_time, cause=e)
                seen_problem = True

                (Till(seconds=61) | please_stop).wait()
            (Till(seconds=11) | please_stop).wait()

    Thread.run("listen for termination", worker).release()


def get_instance_metadata(timeout=None):
    if not isinstance(timeout, (int, float)):
        timeout = Duration(timeout).seconds

    output = dict_to_data({k.replace("-", "_"): v for k, v in boto_utils.get_instance_metadata(timeout=coalesce(timeout, 5), num_retries=2).items()})
    return output


def aws_retry(func):
    def output(*args, **kwargs):
        while True:
            try:
                return func(*args, **kwargs)
            except Exception as e:
                e = Except.wrap(e)
                if "Request limit exceeded" in e:
                    Log.warning("AWS Problem", cause=e)
                    continue
                else:
                    Log.error("Problem with call to AWS", cause=e)
    return output


# GET FROM AWS, IF WE CAN
def _get_metadata_from_from_aws(please_stop):
    with suppress_exception:
        ec2 = get_instance_metadata()
        if ec2:
            machine_metadata.aws_instance_type = ec2.instance_type
            machine_metadata.name = ec2.instance_id

Thread.run("get aws machine metadata", _get_metadata_from_from_aws).release()

from . import s3
