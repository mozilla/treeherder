from jx_bigquery import bigquery
from jx_mysql.mysql import MySQL
from jx_mysql.mysql_snowflake_extractor import MySqlSnowflakeExtractor
from mo_files import File
from mo_json import (json2value,
                     value2json)
from mo_logs import (Log,
                     constants,
                     startup)
from mo_sql import SQL
from mo_times import Timer
from redis import Redis

from treeherder.config.settings import REDIS_URL
from treeherder.perf.models import PerformanceDatum

CONFIG_FILE = (File.new_instance(__file__).parent / "extract_perf.json").abspath


class ExtractPerf:
    def run(self, force=False, restart=False, merge=False):
        try:
            # SETUP LOGGING
            settings = startup.read_settings(filename=CONFIG_FILE)
            constants.set(settings.constants)
            Log.start(settings.debug)

            self.extract(settings, force, restart, merge)
        except Exception as e:
            Log.error("could not extract perf", cause=e)
        finally:
            Log.stop()

    def extract(self, settings, force, restart, merge):
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

            if restart or not state:
                state = 916850000
                redis.set(settings.extractor.key, value2json(state).encode("utf8"))
            else:
                state = json2value(state.decode("utf8"))

            perf_id = state

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
                Log.note("Extracting perfs for perf.id={{perf_id}}", perf_id=perf_id)

                # get_ids = sql_query(
                #     {
                #         "from": "performance_datum",
                #         "select": ["id"],
                #         "where": {"gt": {"id": perf_id}},
                #         "sort": ["id"],
                #         "limit": settings.extractor.chunk_size,
                #     }
                # )
                get_ids = SQL(
                    str(
                        (
                            PerformanceDatum.objects.filter(id__gt=perf_id)
                            .values("id")
                            .order_by("id")[: settings.extractor.chunk_size]
                        ).query
                    )
                )

                sql = extractor.get_sql(get_ids)

                # PULL FROM source, AND PUSH TO destination
                acc = []
                with source.transaction():
                    cursor = source.query(sql, stream=True, row_tuples=True)
                    extractor.construct_docs(cursor, acc.append, False)
                if not acc:
                    break

                # TODO: Remove me July 2021
                # OLD PERF RECORDS HAVE NO CORRESPONDING JOB
                # ADD job.submit_time FOR PARTITIONING
                for a in acc:
                    if not a.job.submit_time:
                        a.job.submit_time = a.push_timestamp
                destination.extend(acc)

                # RECORD THE STATE
                last_doc = acc[-1]
                perf_id = last_doc.id
                redis.set(settings.extractor.key, value2json(perf_id).encode("utf8"))

                if len(acc) < settings.extractor.chunk_size:
                    break

        except Exception as e:
            Log.warning("problem with extraction", cause=e)

        Log.note("done perf extraction")

        try:
            with Timer("merge shards"):
                destination.merge_shards()
        except Exception as e:
            Log.warning("problem with merge", cause=e)

        Log.note("done perf merge")
