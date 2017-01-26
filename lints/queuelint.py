#!/usr/bin/env python

import ast
import re
import sys

procfile_re = re.compile("worker_\w*: .* -Q ([^ ]*)")

procfile_queues = []
with open("Procfile") as f:
    for line in f:
        m = procfile_re.match(line)
        if m:
            procfile_queues.extend(m.group(1).split(","))


code = ast.parse(open("treeherder/config/settings.py").read())

settings_queues = set()

queues_list = None
for item in code.body:
    if isinstance(item, ast.Assign) and item.targets[0].id == "CELERY_TASK_QUEUES":
        queues_list = item.value

if queues_list is None:
    print "Failed to find list of queues in settings file"
    sys.exit(1)

for call in queues_list.elts:
    settings_queues.add(call.args[0].s)

procfile_queues = set(procfile_queues)

if settings_queues != procfile_queues:
    print "ERROR - mismatches found"
    missing_procfile = procfile_queues - settings_queues
    if missing_procfile:
        print "The following queues were in the Procfile, but not in the settings file:\n%s\n" % "\n".join(missing_procfile)
    missing_settings = settings_queues - procfile_queues
    if missing_settings:
        print "The following queues were in the settings, but not in the Procfile:\n%s\n" % "\n".join(missing_settings)
    sys.exit(1)
