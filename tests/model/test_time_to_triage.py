import datetime

MON, TUE, WED, THU, FRI, SAT, SUN = range(1, 8)


def test_triage_due_alert_summary_created_monday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat('2022-05-30')
    test_perf_alert_summary.triage_due_date = None

    assert not test_perf_alert_summary.triage_due_date

    test_perf_alert_summary.update_status()

    # created monday isoweekday = 1 + OKR = 3 => 4
    assert test_perf_alert_summary.triage_due_date.isoweekday() == THU


def test_triage_due_alert_summary_created_tuesday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat('2022-05-31')
    test_perf_alert_summary.triage_due_date = None

    assert not test_perf_alert_summary.triage_due_date

    test_perf_alert_summary.update_status()

    # created tuesday isoweekday = 2 + OKR = 3 => 5
    assert test_perf_alert_summary.triage_due_date.isoweekday() == FRI


def test_triage_due_alert_summary_created_wednesday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat('2022-06-01')
    test_perf_alert_summary.triage_due_date = None

    assert not test_perf_alert_summary.triage_due_date

    test_perf_alert_summary.update_status()

    # created wednesday = 3 + OKR = 3 => 6 (saturday) => 1 (monday)
    assert test_perf_alert_summary.triage_due_date.isoweekday() == MON


def test_triage_due_alert_summary_created_thursday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat('2022-06-02')
    test_perf_alert_summary.triage_due_date = None

    assert not test_perf_alert_summary.triage_due_date

    test_perf_alert_summary.update_status()

    # created thursday = 4 + OKR = 3 => 7 (sunday) => 1 (monday) + 1 day =2
    # 1 (monday) + 1 day (1 day of OKR was saturday) = 2
    assert test_perf_alert_summary.triage_due_date.isoweekday() == TUE


def test_triage_due_alert_summary_created_friday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat('2022-06-03')
    test_perf_alert_summary.triage_due_date = None

    assert not test_perf_alert_summary.triage_due_date

    test_perf_alert_summary.update_status()

    # created friday = 5 + OKR = 3 => 8 => 1 (monday)
    # 1 (monday) + 2 (2 days of OKR were weekend) = 3 (wednesday)
    assert test_perf_alert_summary.triage_due_date.isoweekday() == WED


def test_triage_due_alert_summary_created_saturday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat('2022-06-04')
    test_perf_alert_summary.triage_due_date = None

    assert not test_perf_alert_summary.triage_due_date

    test_perf_alert_summary.update_status()

    # created saturday = 6 => 1 (monday) + OKR = 3 => 4 (thursday)
    assert test_perf_alert_summary.triage_due_date.isoweekday() == THU


def test_triage_due_alert_summary_created_sunday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat('2022-06-05')
    test_perf_alert_summary.triage_due_date = None

    assert not test_perf_alert_summary.triage_due_date

    test_perf_alert_summary.update_status()

    # created sunday = 7 => 1 (monday) + OKR = 3 => 4 (thursday)
    assert test_perf_alert_summary.triage_due_date.isoweekday() == THU


def test_alert_summary_with_modified_created_date(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat('2022-05-30')
    test_perf_alert_summary.triage_due_date = None

    assert not test_perf_alert_summary.triage_due_date

    test_perf_alert_summary.update_status()

    # created monday isoweekday = 1 + OKR = 3 => 4
    assert test_perf_alert_summary.triage_due_date.isoweekday() == THU

    test_perf_alert_summary.created = datetime.datetime.fromisoformat('2022-06-03')

    test_perf_alert_summary.update_status()

    # created friday = 5 + OKR = 3 => 8 => 1 (monday)
    # 1 (monday) + 2 (2 days of OKR were weekend) = 3 (wednesday)
    assert test_perf_alert_summary.triage_due_date.isoweekday() == WED


def test_bug_due_alert_summary_created_monday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat('2022-05-30')
    test_perf_alert_summary.bug_due_date = None

    assert not test_perf_alert_summary.bug_due_date

    test_perf_alert_summary.update_status()

    # created monday isoweekday = 1 + OKR = 5 => 6 (saturday) => 1 (monday)
    assert test_perf_alert_summary.bug_due_date.isoweekday() == MON


def test_bug_due_alert_summary_created_tuesday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat('2022-05-31')
    test_perf_alert_summary.bug_due_date = None

    assert not test_perf_alert_summary.bug_due_date

    test_perf_alert_summary.update_status()

    # created tuesday isoweekday = 2 + OKR = 5 => 7 (saturday) => 1 (monday)
    # 1 (monday) + 1 day (1 day of OKR was saturday) = 2 (tuesday)
    assert test_perf_alert_summary.bug_due_date.isoweekday() == TUE


def test_bug_due_alert_summary_created_wednesday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat('2022-06-01')
    test_perf_alert_summary.bug_due_date = None

    assert not test_perf_alert_summary.bug_due_date

    test_perf_alert_summary.update_status()

    # created wednesday = 3 + OKR = 5 => 1 (monday)
    # 1 (monday) + 2 day (2 day of OKR was saturday) = 3 (wednesday)
    assert test_perf_alert_summary.bug_due_date.isoweekday() == WED


def test_bug_due_alert_summary_created_thursday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat('2022-06-02')
    test_perf_alert_summary.bug_due_date = None

    assert not test_perf_alert_summary.bug_due_date

    test_perf_alert_summary.update_status()

    # created thursday = 4 + OKR = 5 => 2 (tuesday)
    # 2 (tuesday) + 2 day (2 day of OKR was saturday) = 4 (thursday)
    assert test_perf_alert_summary.bug_due_date.isoweekday() == THU


def test_bug_due_alert_summary_created_friday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat('2022-06-03')
    test_perf_alert_summary.bug_due_date = None

    assert not test_perf_alert_summary.bug_due_date

    test_perf_alert_summary.update_status()

    # created friday = 5 + OKR = 5 => 3 (wednesday)
    # 3 (wednesday) + 2 (2 days of OKR were weekend) = 5 (friday)
    assert test_perf_alert_summary.bug_due_date.isoweekday() == FRI


def test_bug_due_alert_summary_created_saturday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat('2022-06-04')
    test_perf_alert_summary.bug_due_date = None

    assert not test_perf_alert_summary.bug_due_date

    test_perf_alert_summary.update_status()

    # created saturday = 6 => 1 (monday) + OKR = 5 => 6 (saturday) => 1 (monday)
    assert test_perf_alert_summary.bug_due_date.isoweekday() == MON


def test_bug_due_alert_summary_created_sunday(test_perf_alert_summary):
    test_perf_alert_summary.created = datetime.datetime.fromisoformat('2022-06-05')
    test_perf_alert_summary.bug_due_date = None

    assert not test_perf_alert_summary.bug_due_date

    test_perf_alert_summary.update_status()

    # created sunday = 7 => 1 (monday) + OKR = 5 => 6 (saturday) => 1 (monday)
    assert test_perf_alert_summary.bug_due_date.isoweekday() == MON
