class NoDataCyclingAtAll(Exception):
    pass


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
