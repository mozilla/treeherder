import datetime

from jx_mysql.mysql import MySQL
from jx_mysql.mysql_snowflake_extractor import MySqlSnowflakeExtractor
from mo_files import File
from mo_future import text
from mo_sql import SQL
from mo_testing.fuzzytestcase import assertAlmostEqual
from treeherder.perf.models import PerformanceAlert, PerformanceAlertSummary


def test_extract_alert_sql(extract_alert_settings, test_perf_alert_summary, test_perf_alert):
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

    extractor = MySqlSnowflakeExtractor(extract_alert_settings.source)
    sql = extractor.get_sql(SQL("SELECT 0"))
    assert "".join(sql.sql.split()) == "".join(EXTRACT_ALERT_SQL.split())


def test_extract_alert(extract_alert_settings, test_perf_alert_summary, test_perf_alert):
    now = datetime.datetime.now()
    source = MySQL(extract_alert_settings.source.database)
    extractor = MySqlSnowflakeExtractor(extract_alert_settings.source)
    sql = extractor.get_sql(SQL("SELECT " + text(test_perf_alert_summary.id) + " as id"))

    acc = []
    with source.transaction():
        cursor = list(source.query(sql, stream=True, row_tuples=True))
        extractor.construct_docs(cursor, acc.append, False)

    doc = acc[0]
    # TEST ARE RUN WITH CURRENT TIMESTAMPS
    doc.created = now
    doc.last_updated = now
    for d in doc.details:
        d.created = now
        d.last_updated = now
        d.series_signature.last_updated = now

    assertAlmostEqual(
        acc, ALERT, places=3
    )  # TH MIXES LOCAL TIMEZONE WITH GMT: https://bugzilla.mozilla.org/show_bug.cgi?id=1612603


EXTRACT_ALERT_SQL = (File(__file__).parent / "test_extract_alerts.sql").read()

ALERT = (File(__file__).parent / "test_extract_alerts.json").read_json()
