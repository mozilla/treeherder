import datetime

MON, TUE, WED, THU, FRI, SAT, SUN = range(1, 8)


def test_triage_due_alert_summary_created_monday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat("2022-05-30")
    test_perf_alert_summary.triage_due_date = None

    assert not test_perf_alert_summary.triage_due_date

    test_perf_alert_summary.update_status()

    # created monday isoweekday = 1 + OKR = 2 => 3
    assert test_perf_alert_summary.triage_due_date.isoweekday() == WED


def test_triage_due_alert_summary_created_tuesday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat("2022-05-31")
    test_perf_alert_summary.triage_due_date = None

    assert not test_perf_alert_summary.triage_due_date

    test_perf_alert_summary.update_status()

    # created tuesday isoweekday = 2 + OKR = 2 => 4
    assert test_perf_alert_summary.triage_due_date.isoweekday() == THU


def test_triage_due_alert_summary_created_wednesday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat("2022-06-01")
    test_perf_alert_summary.triage_due_date = None

    assert not test_perf_alert_summary.triage_due_date

    test_perf_alert_summary.update_status()

    # created wednesday = 3 + OKR = 2 => 5
    assert test_perf_alert_summary.triage_due_date.isoweekday() == FRI


def test_triage_due_alert_summary_created_thursday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat("2022-06-02")
    test_perf_alert_summary.triage_due_date = None

    assert not test_perf_alert_summary.triage_due_date

    test_perf_alert_summary.update_status()

    # created thursday = 4 + OKR = 2 => 6 (saturday) => 1 (monday)
    assert test_perf_alert_summary.triage_due_date.isoweekday() == MON


def test_triage_due_alert_summary_created_friday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat("2022-06-03")
    test_perf_alert_summary.triage_due_date = None

    assert not test_perf_alert_summary.triage_due_date

    test_perf_alert_summary.update_status()

    # created friday = 5 + OKR = 2 => 7 (sunday) => 1 (monday)
    # 1 (monday) + 1 day (1 day of OKR was saturday) = 2 (tuesday)
    assert test_perf_alert_summary.triage_due_date.isoweekday() == TUE


def test_triage_due_alert_summary_created_saturday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat("2022-06-04")
    test_perf_alert_summary.triage_due_date = None

    assert not test_perf_alert_summary.triage_due_date

    test_perf_alert_summary.update_status()

    # created saturday = 6 => 1 (monday) + OKR = 2 => 3 (wednesday)
    assert test_perf_alert_summary.triage_due_date.isoweekday() == WED


def test_triage_due_alert_summary_created_sunday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat("2022-06-05")
    test_perf_alert_summary.triage_due_date = None

    assert not test_perf_alert_summary.triage_due_date

    test_perf_alert_summary.update_status()

    # created sunday = 7 => 1 (monday) + OKR = 2 => 3 (wednesday)
    assert test_perf_alert_summary.triage_due_date.isoweekday() == WED


def test_alert_summary_with_modified_created_date(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat("2022-05-30")
    test_perf_alert_summary.triage_due_date = None

    assert not test_perf_alert_summary.triage_due_date

    test_perf_alert_summary.update_status()

    # created monday isoweekday = 1 + OKR = 2 => 3
    assert test_perf_alert_summary.triage_due_date.isoweekday() == WED

    test_perf_alert_summary.created = datetime.datetime.fromisoformat("2022-06-03")

    test_perf_alert_summary.update_status()

    # created friday = 5 + OKR = 2 => 7 (sunday) => 1 (monday)
    # 1 (monday) + 1 day (1 day of OKR was saturday) = 2 (tuesday)
    assert test_perf_alert_summary.triage_due_date.isoweekday() == TUE


def test_bug_due_alert_summary_created_monday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat("2022-05-30")
    test_perf_alert_summary.bug_due_date = None

    assert not test_perf_alert_summary.bug_due_date

    test_perf_alert_summary.update_status()

    # created monday isoweekday = 1 + OKR = 4 => 5 (friday)
    assert test_perf_alert_summary.bug_due_date.isoweekday() == FRI


def test_bug_due_alert_summary_created_tuesday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat("2022-05-31")
    test_perf_alert_summary.bug_due_date = None

    assert not test_perf_alert_summary.bug_due_date

    test_perf_alert_summary.update_status()

    # created tuesday isoweekday = 2 + OKR = 4 => 6 (saturday) => 1 (monday)
    assert test_perf_alert_summary.bug_due_date.isoweekday() == MON


def test_bug_due_alert_summary_created_wednesday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat("2022-06-01")
    test_perf_alert_summary.bug_due_date = None

    assert not test_perf_alert_summary.bug_due_date

    test_perf_alert_summary.update_status()

    # created wednesday = 3 + OKR = 4 => 7 (sunday) => 1 (monday)
    # 1 (monday) + 1 day (1 day of OKR was saturday) = 2 (tuesday)
    assert test_perf_alert_summary.bug_due_date.isoweekday() == TUE


def test_bug_due_alert_summary_created_thursday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat("2022-06-02")
    test_perf_alert_summary.bug_due_date = None

    assert not test_perf_alert_summary.bug_due_date

    test_perf_alert_summary.update_status()

    # created thursday = 4 + OKR = 4 => 1 (monday)
    # 1 (monday) + 2 days (2 days of OKR were weekend) = 3 (wednesday)
    assert test_perf_alert_summary.bug_due_date.isoweekday() == WED


def test_bug_due_alert_summary_created_friday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat("2022-06-03")
    test_perf_alert_summary.bug_due_date = None

    assert not test_perf_alert_summary.bug_due_date

    test_perf_alert_summary.update_status()

    # created friday = 5 + OKR = 4 => 2 (tuesday)
    # 2 (tuesday) + 2 days (2 days of OKR were weekend) = 4 (thursday)
    assert test_perf_alert_summary.bug_due_date.isoweekday() == THU


def test_bug_due_alert_summary_created_saturday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat("2022-06-04")
    test_perf_alert_summary.bug_due_date = None

    assert not test_perf_alert_summary.bug_due_date

    test_perf_alert_summary.update_status()

    # created saturday = 6 => 1 (monday) + OKR = 4 => 5 (friday)
    assert test_perf_alert_summary.bug_due_date.isoweekday() == FRI


def test_bug_due_alert_summary_created_sunday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat("2022-06-05")
    test_perf_alert_summary.bug_due_date = None

    assert not test_perf_alert_summary.bug_due_date

    test_perf_alert_summary.update_status()

    # created sunday = 7 => 1 (monday) + OKR = 4 => 5 (friday)
    assert test_perf_alert_summary.bug_due_date.isoweekday() == FRI
