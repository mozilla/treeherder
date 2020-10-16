class NoDataCyclingAtAll(Exception):
    def __str__(self):
        msg = 'No data cycling could be performed.'
        if self.__cause__:
            msg = f'{msg} (Reason: {self.__cause__})'
        return msg


class MaxRuntimeExceeded(Exception):
    pass


class MissingRecords(Exception):
    pass


class CannotBackfill(Exception):
    pass


class NoFiledBugs(Exception):
    pass


class BugzillaEndpointError(RuntimeError):
    pass
