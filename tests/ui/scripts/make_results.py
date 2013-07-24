#!/usr/bin/env python

import csv
import json
import sys
import random

# {
#             "platform": platform_name,
#             jobs:[
#                 {
#                     "id",
#                     "symbol":"",
#                     "description":"",
#                     "status": "pending|running|completed|retriggered, etc.."
#
#                 }
#             ]
#
#         }

def get_group(group_jobs, statuses):
    items = group_jobs.split()
    group = {
        "type": "group",
        "symbol": items[0].strip("<>"),
    }
    jobs = []
    for job in items[1:]:
        jobs.append({
            "id": 5,
            "symbol": job,
            "status": random.choice(statuses)

        })
    group["jobs"] = jobs
    return group

output = []
with open(sys.argv[1], 'rb') as csvfile:
    reader = csv.reader(csvfile)
    # 1/2 the time, make all tests passing
    if random.randint(0, 1) == 1:
        statuses = [
            "pending",
            "running",
            "completed",
            "retriggered",
            "fail",
            "orange"
        ]
    else:
        statuses = ["completed"]

    for row in reader:
        platform = {
            "platform": row[0].strip()
        }

        # print row
        job_groups = row[1:]
        jobs = []

        for group in job_groups:
            if group.startswith("<"):
                # it's a group
                jobs.append(get_group(group, statuses))
            else:
                items = group.split()
                for job in items:
                    jobs.append({
                        "id": 5,
                        "symbol": job,
                        "status": random.choice(statuses)
                    })

        platform["jobs"] = jobs
        output.append(platform)

    print json.dumps(output, indent=4)
