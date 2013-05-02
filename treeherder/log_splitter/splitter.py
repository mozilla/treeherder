
import datetime
import re

date_pattern = '(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}.\d+)'
re_start = re.compile('========= Started (.*?) \(results: \d+, elapsed: (?:\d+ mins, )?\d+ secs\) \(at ' + date_pattern + '\) =========')
re_finish = re.compile('========= Finished (.*?) \(results: \d+, elapsed: (?:\d+ mins, )?\d+ secs\) \(at ' + date_pattern + '\) =========')
re_property = re.compile('(\w*): (.*)')
date_format = '%Y-%m-%d %H:%M:%S.%f'

def split(file):
    log = Log()
    properties_done = False
    step = None
    for line in file:
        # collect the properties first
        if not properties_done:
            match = re_property.match(line)
            if match is None:
                properties_done = True
            else:
                log.properties[match.group(1)] = match.group(2)
            continue
        # then look for a start marker:
        if step is None:
            match = re_start.match(line)
            if match is not None:
                start_time = datetime.datetime.strptime(match.group(2), date_format)
                step = Step(match.group(1), start_time)
                log.steps.append(step)
        # check for the end marker, otherwise collect the log
        else:
            match = re_finish.match(line)
            if match is None:
                step.log.append(line)
                continue
            assert match.group(1) == step.name
            end_time = datetime.datetime.strptime(match.group(2), date_format)
            step.end_time = end_time
            step = None

    return log

class Log(object):
    """
    """

    def __init__(self):
        self.properties = {}
        self.steps = []

class Step(object):
    """
    """

    def __init__(self, name, start_time):
        self.name = name
        self.start_time = start_time
        self.end_time = None
        self.log = []

