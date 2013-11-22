from treeherder.etl import buildbot
import pprint

result = {}
for group in buildbot.GROUP_NAMES:
    for name in buildbot.GROUP_NAMES[group]:
        result[name] = group

pprint.pprint(result)