
class Splitter(object):
    """
    `start` and `end` should be tuples of type (regexp, mapping[, matching])
    `regexp` is used to match the start end and of a step
    `mapping` is a list corresponding to the capture groups in the regexp.
    Each mapping can be
        * a string, in which case a named attr will be added to the step
        * a callback function taking (step, match)
        * None, to skip that regexp group
    `end` can also have a `matching`, which is a list that matches capture
    groups from the end to capture groups from the start
    """
    def __init__(self, start, end):
        self._start = start
        self._end = end

    def split(self, file):
        """
        `file` should be any iterable object/generator that yields lines
        """
        steps = [Step(0)]
        step = steps[0]
        startmatch = None

        def apply_match(which, match):
            # apply the mapping for the capture group
            for i, mapping in enumerate(which[1]):
                if mapping is None:
                    continue
                if type(mapping) == str:
                    setattr(step, mapping, match.group(1 + i))
                else: # must be a function
                    mapping(step, match.group(1 + i))
            if len(which) == 3:
                # selected properties of the start and end match should be equal
                for i, matching in enumerate(which[2]):
                    if matching is not None:
                        assert match.group(1 + i) == startmatch.group(matching)

        for lineno, line in enumerate(file):
            # look for a start marker
            if startmatch is None:
                match = self._start[0].match(line)
                if match is not None:
                    step = Step(lineno)
                    steps.append(step)
                    startmatch = match
                    apply_match(self._start, match)
            # check for the end marker
            else:
                match = self._end[0].match(line)
                if match is not None:
                    apply_match(self._end, match)
                    startmatch = None
            step.lines.append(line)

        return steps

class Step(object):
    """
    """

    def __init__(self, lineno):
        self.lineno = lineno
        self.lines = []

