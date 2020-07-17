import datetime

import pytest

from jx_mysql.mysql import MySQL
from jx_mysql.mysql_snowflake_extractor import MySqlSnowflakeExtractor
from mo_files import File
from mo_future import text
from mo_sql import SQL
from mo_testing.fuzzytestcase import assertAlmostEqual
from treeherder.perf.models import PerformanceAlert, PerformanceAlertSummary


def test_extract_alert_sql(extract_alert_settings, test_perf_alert_summary, test_perf_alert):
    """
    If you find this test failing, then replace the contents of test_extract_alerts.sql with the contents of the `sql`
    variable below. You can then review the resulting diff.
    """

    p = test_perf_alert
    s2 = PerformanceAlertSummary.objects.create(
        id=2,
        repository=test_perf_alert_summary.repository,
        prev_push_id=3,
        push_id=4,
        created=datetime.datetime.now(),
        framework=test_perf_alert_summary.framework,
        manually_created=False,
    )

    # set related summary with downstream status, make sure that works
    # p = PerformanceAlert.objects.get(id=1)
    p.status = PerformanceAlert.DOWNSTREAM
    p.related_summary = s2
    p.save()

    with MySqlSnowflakeExtractor(extract_alert_settings.source) as extractor:
        sql = extractor.get_sql(SQL("SELECT 0"))

    assert "".join(sql.sql.split()) == "".join(EXTRACT_ALERT_SQL.split())


@pytest.mark.freeze_time('2020-07-01', ignore=['mo_threads'])
def test_extract_alert(extract_alert_settings, test_perf_alert_summary, test_perf_alert):
    """
    If you find this test failing, then copy the JSON in the test failure into the test_extract_alerts.json file,
    then you may use the diff to review the changes.
    """
    with MySQL(extract_alert_settings.source.database) as source:
        with MySqlSnowflakeExtractor(extract_alert_settings.source) as extractor:
            sql = extractor.get_sql(SQL("SELECT " + text(test_perf_alert_summary.id) + " as id"))

            acc = []
            with source.transaction():
                cursor = list(source.query(sql, stream=True, row_tuples=True))
                extractor.construct_docs(cursor, acc.append, False)

    assertAlmostEqual(
        acc, ALERT, places=3
    )  # TH MIXES LOCAL TIMEZONE WITH GMT: https://bugzilla.mozilla.org/show_bug.cgi?id=1612603


EXTRACT_ALERT_SQL = (File(__file__).parent / "test_extract_alerts.sql").read()

ALERT = (File(__file__).parent / "test_extract_alerts.json").read_json()
