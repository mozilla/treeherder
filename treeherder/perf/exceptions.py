class NoDataCyclingAtAllError(Exception):
    def __str__(self):
        msg = "No data cycling could be performed."
        if self.__cause__:
            msg = f"{msg} (Reason: {self.__cause__})"
        return msg


class MaxRuntimeExceededError(Exception):
    pass


class MissingRecordsError(Exception):
    pass


class CannotBackfillError(Exception):
    pass


class NoFiledBugsError(Exception):
    pass


class BugzillaEndpointError(RuntimeError):
    pass
