from jx_base.expressions import NULL
from jx_mysql.mysql import MySQL
from jx_mysql.mysql_snowflake_extractor import MySqlSnowflakeExtractor
from mo_files import File
from mo_future import text
from mo_sql import SQL
from mo_testing.fuzzytestcase import assertAlmostEqual


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
        result = source.query(SQL("SELECT count(1) as num from job_detail"))

    assert result[0].num == 4


# VERIFY SQL OVER DATABASE
def test_extract_job_sql(extract_job_settings, transactional_db):
    extractor = MySqlSnowflakeExtractor(extract_job_settings.source)
    sql = extractor.get_sql(SQL("SELECT 0"))
    assert "".join(sql.sql.split()) == "".join(EXTRACT_JOB_SQL.split())


def test_extract_job(complex_job, extract_job_settings, now):
    source = MySQL(extract_job_settings.source.database)
    # with source.transaction():
    #     result = source.query(SQL("SELECT * from text_log_error"))
    # assert result[0].guid == complex_job.guid
    extractor = MySqlSnowflakeExtractor(extract_job_settings.source)
    sql = extractor.get_sql(SQL("SELECT " + text(complex_job.id) + " as id"))

    acc = []
    with source.transaction():
        cursor = list(source.query(sql, stream=True, row_tuples=True))
        extractor.construct_docs(cursor, acc.append, False)

    doc = acc[0]
    doc.guid = complex_job.guid
    doc.last_modified = complex_job.last_modified

    assertAlmostEqual(acc, JOB, places=3)  # TH MIXES LOCAL TIMEZONE WITH GMT: https://bugzilla.mozilla.org/show_bug.cgi?id=1612603


EXTRACT_JOB_SQL = (File(__file__).parent / "test_extract_job.sql").read()

JOB = (File(__file__).parent / "test_extract_job.json").read_json()
JOB.job_group.description = NULL  # EXPECTING NOTHING
