import datetime
import re

from splitter import Splitter

pattern = ' (.*?) \(results: \d+, elapsed: (?:\d+ mins, )?\d+ secs\) \(at (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}.\d+)\) ={9}'
re_start = re.compile('={9} Started' + pattern)
re_finish = re.compile('={9} Finished' + pattern)
re_property = re.compile('(\w*): (.*)')
date_format = '%Y-%m-%d %H:%M:%S.%f'

def parsetime(match):
    return datetime.datetime.strptime(match, date_format)

splitter = Splitter(
    (
        re_start,
        ['name', lambda step, match: setattr(step, 'start_time', parsetime(match))]
    ),
    (
        re_finish,
        [None, lambda step, match: setattr(step, 'end_time', parsetime(match))],
        [1]
    )
)

def split(file):
    steps = splitter.split(file)
    properties = {}
    for line in steps[0].lines:
        match = re_property.match(line)
        if match is not None:
            properties[match.group(1)] = match.group(2)
    return Log(properties, steps)

class Log(object):
    def __init__(self, properties, steps):
        self.properties = properties
        self.steps = steps

