from jx_bigquery import bigquery
from jx_mysql.mysql import (MySQL,
                            sql_query)
from jx_mysql.mysql_snowflake_extractor import MySqlSnowflakeExtractor
from jx_python import jx
from mo_files import File
from mo_json import (json2value,
                     value2json)
from mo_logs import (Log,
                     constants,
                     startup,
                     strings)
from mo_sql import SQL
from mo_times import Timer
from mo_times.dates import Date
from redis import Redis

from treeherder.config.settings import REDIS_URL

CONFIG_FILE = (File.new_instance(__file__).parent / "extract_jobs.json").abspath


class ExtractJobs:
    def run(self, force=False, restart=False, start=None, merge=False):
        try:
            # SETUP LOGGING
            settings = startup.read_settings(filename=CONFIG_FILE)
            constants.set(settings.constants)
            Log.start(settings.debug)

            self.extract(settings, force, restart, start, merge)
        except Exception as e:
            Log.error("could not extract jobs", cause=e)
        finally:
            Log.stop()

    def extract(self, settings, force, restart, start, merge):
        if not settings.extractor.app_name:
            Log.error("Expecting an extractor.app_name in config file")

        # SETUP DESTINATION
        destination = bigquery.Dataset(
            dataset=settings.extractor.app_name, kwargs=settings.destination
        ).get_or_create_table(settings.destination)

        try:
            if merge:
                with Timer("merge shards"):
                    destination.merge_shards()

            # RECOVER LAST SQL STATE
            redis = Redis.from_url(REDIS_URL)
            state = redis.get(settings.extractor.key)

            if start:
                state = start, 0
            elif restart or not state:
                state = (0, 0)
                redis.set(settings.extractor.key, value2json(state).encode("utf8"))
            else:
                state = json2value(state.decode("utf8"))

            last_modified, job_id = state

            # SCAN SCHEMA, GENERATE EXTRACTION SQL
            extractor = MySqlSnowflakeExtractor(settings.source)
            canonical_sql = extractor.get_sql(SQL("SELECT 0"))

            # ENSURE SCHEMA HAS NOT CHANGED SINCE LAST RUN
            old_sql = redis.get(settings.extractor.sql)
            if old_sql and old_sql.decode("utf8") != canonical_sql.sql:
                if force:
                    Log.warning("Schema has changed")
                else:
                    Log.error("Schema has changed")
            redis.set(settings.extractor.sql, canonical_sql.sql.encode("utf8"))

            # SETUP SOURCE
            source = MySQL(settings.source.database)

            while True:
                Log.note(
                    "Extracting jobs for last_modified={{last_modified|datetime|quote}}, job.id={{job_id}}",
                    last_modified=last_modified,
                    job_id=job_id,
                )

                # Example: job.id ==283890114
                # get_ids = ConcatSQL(
                #     (SQL_SELECT, sql_alias(quote_value(283890114), "id"))
                # )
                get_ids = sql_query(
                    {
                        "from": "job",
                        "select": ["id"],
                        "where": {
                            "or": [
                                {"gt": {"last_modified": Date(last_modified)}},
                                {
                                    "and": [
                                        {"eq": {"last_modified": Date(last_modified)}},
                                        {"gt": {"id": job_id}},
                                    ]
                                },
                            ]
                        },
                        "sort": ["last_modified", "id"],
                        "limit": settings.extractor.chunk_size,
                    }
                )
                sql = extractor.get_sql(get_ids)

                # PULL FROM source, AND PUSH TO destination
                acc = []
                with source.transaction():
                    cursor = source.query(sql, stream=True, row_tuples=True)
                    extractor.construct_docs(cursor, acc.append, False)
                if not acc:
                    break

                # SOME LIMITS PLACES ON STRING SIZE
                for fl in jx.drill(acc, "job_log.failure_line"):
                    fl.message = strings.limit(fl.message, 10000)

                destination.extend(acc)

                # RECORD THE STATE
                last_doc = acc[-1]
                last_modified, job_id = last_doc.last_modified, last_doc.id
                redis.set(
                    settings.extractor.key,
                    value2json((last_modified, job_id)).encode("utf8"),
                )

                if len(acc) < settings.extractor.chunk_size:
                    break

        except Exception as e:
            Log.warning("problem with extraction", cause=e)

        Log.note("done job extraction")

        try:
            with Timer("merge shards"):
                destination.merge_shards()
        except Exception as e:
            Log.warning("problem with merge", cause=e)

        Log.note("done job merge")
