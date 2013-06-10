#!/usr/bin/env python

import sys
import urllib2


def download_logs(filename):
    """
    Download all ``log_references`` in job objects within a file.
    Logs downloaded will be put in the working directory.

    USAGE: download_logs <filename>

        ``filename`` - A txt file with JSON Job objects

    Job objects should look like this:
        {
            "sources": [
                {
                    "commit_timestamp": 1370459461,
                    "push_timestamp": 1370459461,
                    "comments": "Backed out changeset fe9dcdf48551 (bug 879374) for mochitest-3 crashes.",
                    "repository": "mozilla-inbound",
                    "revision": "a54df4462572"
                }
            ],
            "job": {
                "submit_timestamp": 1370459521,
                "option_collection": {
                    "opt": true
                },
                "who": "sendchange-unittest",
                "artifact": {},
                "machine_platform": {
                    "platform": "2.2",
                    "os_name": "android",
                    "architecture": "ARMv7",
                    "vm": false
                },
                "reason": "scheduler",
                "result": 0,
                "job_guid": "808f4f1372895eda5ecd65f2371ebe67a2a9af9b",
                "end_timestamp": "1370461182",
                "build_platform": {
                    "platform": "2.2",
                    "os_name": "android",
                    "architecture": "ARMv7",
                    "vm": false
                },
                "start_timestamp": 1370484722,
                "name": "xpcshell",
                "log_references": [
                    {
                        "url": "http://ftp.mozilla.org/pub/mozilla.org/mobile/tinderbox-builds/mozilla-inbound-android/1370454517/mozilla-inbound_tegra_android_test-xpcshell-bm22-tests1-tegra-build690.txt.gz",
                        "name": "unittest"
                    }
                ],
                "machine": "tegra-132",
                "state": "TODO",
                "product_name": "mobile"
            },
            "revision_hash": "0686a4d3fa477cb0415c9ca590177e4b03919b64"
        }


    """
    lognames = []
    job_data = open(filename).read()
    for job in job_data:
        logrefs = job["job"]["log_references"]
        for log in logrefs:
            lognames.append(log["name"])
            url = log["url"]
            try:
                handle = urllib2.urlopen(url)
                with open(url.rsplit("/", 1)[1], "wb") as out:
                    while True:
                        data = handle.read(1024)
                        if len(data) == 0:
                            break
                        out.write(data)
            except urllib2.HTTPError:
                pass

    assert set(lognames) == ""


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print ("USAGE: download_logs <filename>\n"
               "Where <filename> is a txt file with JSON Job objects")
    else:
        download_logs(sys.argv[1])
