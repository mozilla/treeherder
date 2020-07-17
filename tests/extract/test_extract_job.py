import pytest
from django.db.models import Q

from jx_base.expressions import NULL
from jx_mysql.mysql import MySQL
from jx_mysql.mysql_snowflake_extractor import MySqlSnowflakeExtractor
from jx_python import jx
from mo_files import File
from mo_future import text, first
from mo_sql import SQL
from mo_testing.fuzzytestcase import assertAlmostEqual
from mo_times import Date
from treeherder.model.models import Job


def test_make_repository(test_repository, extract_job_settings):
    # TEST EXISTING FIXTURE MAKES AN OBJECT IN THE DATABASE
    source = MySQL(extract_job_settings.source.database)
    with source.transaction():
        result = source.query(SQL("SELECT * from repository"))

    # verify the repository object is the one we expect
    assert result[0].id == test_repository.id
    assert result[0].tc_root_url == test_repository.tc_root_url


def test_make_failure_class(failure_class, extract_job_settings):
    # TEST I CAN MAKE AN OBJECT IN THE DATABASE
    source = MySQL(extract_job_settings.source.database)
    with source.transaction():
        result = source.query(SQL("SELECT * from failure_classification"))

    # verify the repository object is the one we expect
    assert result[0].name == "not classified"


def test_make_job(complex_job, extract_job_settings):
    source = MySQL(extract_job_settings.source.database)
    with source.transaction():
        result = source.query(SQL("SELECT count(1) as num from job"))

    assert result[0].num == 1


def test_extract_job_sql(extract_job_settings, transactional_db):
    """
    VERIFY SQL OVER DATABASE

    If you find this test failing, then replace the contents of test_extract_job.sql with the contents of the `sql`
    variable below. You can then review the resulting diff.
    """
    with MySqlSnowflakeExtractor(extract_job_settings.source) as extractor:
        sql = extractor.get_sql(SQL("SELECT 0"))
    assert "".join(sql.sql.split()) == "".join(EXTRACT_JOB_SQL.split())


def test_django_cannot_encode_datetime(extract_job_settings):
    """
    DJANGO DOES NOT ENCODE THE DATETIME PROPERLY
    """
    epoch = Date(Date.EPOCH).datetime
    get_ids = SQL(
        str(
            (
                Job.objects.filter(
                    Q(last_modified__gt=epoch) | (Q(last_modified=epoch) & Q(id__gt=0))
                )
                .annotate()
                .values("id")
                .order_by("last_modified", "id")[:2000]
            ).query
        )
    )
    source = MySQL(extract_job_settings.source.database)

    with pytest.raises(Exception):
        with source.transaction():
            list(source.query(get_ids, stream=True, row_tuples=True))


def test_django_cannot_encode_datetime_strings(extract_job_settings):
    """
    DJANGO/MYSQL DATETIME MATH WORKS WHEN STRINGS
    """
    epoch_string = Date.EPOCH.format()
    sql_query = SQL(
        str(
            (
                Job.objects.filter(
                    Q(last_modified__gt=epoch_string)
                    | (Q(last_modified=epoch_string) & Q(id__gt=0))
                )
                .annotate()
                .values("id")
                .order_by("last_modified", "id")[:2000]
            ).query
        )
    )
    source = MySQL(extract_job_settings.source.database)

    with pytest.raises(Exception):
        with source.transaction():
            list(source.query(sql_query, stream=True, row_tuples=True))


@pytest.mark.freeze_time('2020-07-01', ignore=['mo_threads'])
def test_extract_job(complex_job, extract_job_settings):
    """
    If you find this test failing, then copy the JSON in the test failure into the test_extract_job.json file,
    then you may use the diff to review the changes.
    """
    with MySQL(extract_job_settings.source.database) as source:
        with MySqlSnowflakeExtractor(extract_job_settings.source) as extractor:
            sql = extractor.get_sql(SQL("SELECT " + text(complex_job.id) + " as id"))

            acc = []
            with source.transaction():
                cursor = list(source.query(sql, stream=True, row_tuples=True))
                extractor.construct_docs(cursor, acc.append, False)

    doc = first(acc)
    doc.guid = first(JOB).guid  # NEW EACH TIME

    job_guid = first(jx.drill(JOB, "job_log.failure_line.job_guid"))
    for fl in jx.drill(doc, "job_log.failure_line"):
        fl.job_guid = job_guid

    assertAlmostEqual(
        acc,
        JOB,
        places=4,  # TH MIXES LOCAL TIMEZONE WITH GMT: https://bugzilla.mozilla.org/show_bug.cgi?id=1612603
    )


EXTRACT_JOB_SQL = (File(__file__).parent / "test_extract_job.sql").read()

JOB = (File(__file__).parent / "test_extract_job.json").read_json()
JOB.job_group.description = NULL  # EXPECTING NOTHING
