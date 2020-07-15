# encoding: utf-8
#
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http:# mozilla.org/MPL/2.0/.
#
# Contact: Kyle Lahnakoski (kyle@lahnakoski.com)
#
from __future__ import absolute_import, division, unicode_literals

import re
from copy import copy

from google.cloud import bigquery
from google.oauth2 import service_account

from jx_base import Container as BaseContainer, Facts as BaseFacts
from jx_bigquery import snowflakes
from jx_bigquery.snowflakes import Snowflake
from jx_bigquery.sql import (
    quote_column,
    ALLOWED,
    sql_call,
    sql_alias,
    escape_name,
    ApiName,
    sql_query,
)
from jx_bigquery.typed_encoder import (
    NESTED_TYPE,
    typed_encode,
    REPEATED,
    json_type_to_bq_type,
    INTEGER_TYPE,
    untyped,
)
from jx_python import jx
from mo_dots import listwrap, unwrap, join_field, Null, is_data, Data, wrap, set_default, dict_to_data, leaves_to_data, \
    from_data
from mo_future import is_text, text, first
from mo_json import INTEGER
from mo_kwargs import override
from mo_logs import Log, Except
from mo_math.randoms import Random
from jx_bigquery.sql import (
    ConcatSQL,
    SQL,
    SQL_SELECT,
    JoinSQL,
    SQL_NULL,
    SQL_FROM,
    SQL_COMMA,
    SQL_AS,
    SQL_ORDERBY,
    SQL_CR,
    SQL_SELECT_AS_STRUCT,
    SQL_INSERT,
    SQL_DESC,
    SQL_UNION_ALL,
)
from mo_threads import Till, Lock, Queue
from mo_times import MINUTE, Timer
from mo_times.dates import Date

DEBUG = False
EXTEND_LIMIT = 2 * MINUTE  # EMIT ERROR IF ADDING RECORDS TO TABLE TOO OFTEN
MAX_MERGE = 10  # MAXIMUM NUMBER OF TABLES TO MERGE AT ONCE
SUFFIX_PATTERN = re.compile(r"__\w{20}")


def connect(account_info):
    creds = service_account.Credentials.from_service_account_info(info=account_info)
    client = bigquery.Client(project=account_info.project_id, credentials=creds)
    return client


def create_dataset(project_id, dataset, client):
    full_name = ApiName(project_id) + escape_name(dataset)

    _dataset = bigquery.Dataset(text(full_name))
    _dataset.location = "US"
    return client.create_dataset(_dataset)


def find_dataset(dataset, client):
    esc_name = escape_name(dataset)

    datasets = list(client.list_datasets())
    for _dataset in datasets:
        if ApiName(_dataset.dataset_id) == esc_name:
            return _dataset.reference


class Dataset(BaseContainer):
    """
    REPRESENT A BIGQUERY DATASET; aka A CONTAINER FOR TABLES; aka A DATABASE
    """

    @override
    def __init__(self, dataset, account_info, kwargs):
        self.client = connect(account_info)
        self.short_name = dataset
        esc_name = escape_name(dataset)
        self.full_name = ApiName(account_info.project_id) + esc_name

        self.dataset = find_dataset(dataset, self.client)
        if not self.dataset:
            self.dataset = create_dataset(account_info.project_id, dataset, self.client)

    @override
    def get_or_create_table(
        self,
        table,
        schema=None,
        typed=True,
        read_only=False,
        sharded=False,
        partition=None,
        cluster=None,  # TUPLE OF FIELDS TO SORT DATA
        id=None,
        kwargs=None,
    ):
        if kwargs.lookup != None or kwargs.flake != None:
            Log.error("expecting schema, not lookup")
        try:
            return Table(kwargs=kwargs, container=self)
        except Exception as e:
            e = Except.wrap(e)
            if not read_only and "Not found: Table" in e:
                return self.create_table(kwargs)
            Log.error("could not get table {{table}}", table=table, cause=e)

    @override
    def create_or_replace_table(
        self,
        table,
        schema=None,
        typed=True,
        read_only=False,
        partition=None,
        cluster=None,  # TUPLE OF FIELDS TO SORT DATA
        sharded=False,
        kwargs=None,
    ):
        if kwargs.lookup != None or kwargs.flake != None:
            Log.error("expecting schema, not lookup")

        try:
            self.delete_table(table)
        except Exception as e:
            e = Except.wrap(e)
            if "Not found: Table" not in e and "Unable to get TableReference" not in e:
                Log.error("could not get table {{table}}", table=table, cause=e)
        return self.create_table(kwargs=kwargs)

    def delete_table(self, name):
        api_name = escape_name(name)

        tables = list(self.client.list_tables(self.dataset))
        for table_item in tables:
            table = table_item.reference
            table_api_name = ApiName(table.table_id)
            if text(table_api_name).startswith(text(api_name)):
                if table_api_name == api_name:
                    if table_item.table_type != "VIEW":
                        Log.error("expecting {{table}} to be a view", table=api_name)
                    self.client.delete_table(table)
                elif SUFFIX_PATTERN.match(text(table_api_name)[len(text(api_name)) :]):
                    try:
                        self.client.delete_table(table)
                    except Exception as e:
                        Log.warning(
                            "could not delete table {{table}}", table=table, cause=e
                        )

    @override
    def create_table(
        self,
        table,
        schema=None,
        typed=True,
        read_only=True,  # TO PREVENT ACCIDENTAL WRITING
        sharded=False,
        partition=Null,  # PARTITION RULES
        cluster=None,  # TUPLE OF FIELDS TO SORT DATA
        top_level_fields=Null,
        kwargs=None,
    ):
        if kwargs.lookup != None or kwargs.flake != None:
            Log.error("expecting schema, not lookup")
        full_name = self.full_name + escape_name(table)
        if not schema:
            # WE MUST HAVE SOMETHING
            if typed:
                schema = copy(DEFAULT_TYPED_SCHEMA)
            else:
                schema = copy(DEFAULT_SCHEMA)

        flake = Snowflake(text(full_name), top_level_fields, partition, schema=schema)

        if read_only:
            Log.error("Can not create a table for read-only use")

        if sharded:
            shard_name = escape_name(table + "_" + "".join(Random.sample(ALLOWED, 20)))
            shard_api_name = self.full_name + shard_name
            _shard = bigquery.Table(text(shard_api_name), schema=flake.to_bq_schema())
            _shard.time_partitioning = unwrap(flake._partition.bq_time_partitioning)
            _shard.clustering_fields = [
                c.es_column
                for f in listwrap(cluster)
                for c in [first(flake.leaves(f))]
                if c
            ] or None
            self.shard = self.client.create_table(_shard)
            self.create_view(full_name, shard_api_name)
        else:
            _table = bigquery.Table(text(full_name), schema=flake.to_bq_schema())
            _table.time_partitioning = unwrap(flake._partition.bq_time_partitioning)
            _table.clustering_fields = [
                l.es_column for f in listwrap(cluster) for l in flake.leaves(f)
            ] or None
            self.client.create_table(_table)
            Log.note("created table {{table}}", table=_table.table_id)

        return Table(
            table=table,
            typed=typed,
            read_only=read_only,
            sharded=sharded,
            partition=partition,
            top_level_fields=top_level_fields,
            kwargs=kwargs,
            container=self,
        )

    def create_view(self, view_api_name, shard_api_name):
        sql = ConcatSQL(
            SQL("CREATE VIEW\n"),
            quote_column(view_api_name),
            SQL_AS,
            SQL(f"SELECT * FROM {quote_column(shard_api_name)}"),
        )
        job = self.query_and_wait(sql)
        if job.errors:
            Log.error(
                "Can not create view\n{{sql}}\n{{errors|json|indent}}",
                sql=sql,
                errors=job.errors,
            )
        pass

    def query_and_wait(self, sql):
        job = self.client.query(text(sql))
        while job.state == "RUNNING":
            DEBUG and Log.note(
                "job {{id}} state = {{state}}", id=job.job_id, state=job.state
            )
            Till(seconds=1).wait()
            job = self.client.get_job(job.job_id)
        DEBUG and Log.note(
            "job {{id}} state = {{state}}", id=job.job_id, state=job.state
        )
        return job


class Table(BaseFacts):
    @override
    def __init__(
        self,
        table,
        typed,
        read_only,
        sharded,
        container,
        id=Null,
        partition=Null,
        cluster=Null,
        top_level_fields=Null,
        kwargs=None,
    ):
        self.short_name = table
        self.typed = typed
        self.read_only = read_only
        self.cluster = cluster
        self.id = id
        self.top_level_fields = top_level_fields
        self.config = Data(  # USED TO REPLICATE THIS
            typed=typed,
            read_only=read_only,
            sharded=sharded,
            id=id,
            partition=partition,
            cluster=cluster,
            top_level_fields=top_level_fields,
        )

        esc_name = escape_name(table)
        self.full_name = container.full_name + esc_name
        self.alias_view = alias_view = container.client.get_table(text(self.full_name))
        self.partition = partition
        self.container = container

        if not sharded:
            if not read_only and alias_view.table_type == "VIEW":
                Log.error("Expecting a table, not a view")
            self.shard = alias_view
            self._flake = Snowflake.parse(
                alias_view.schema,
                text(self.full_name),
                self.top_level_fields,
                partition,
            )
        else:
            if alias_view.table_type != "VIEW":
                Log.error("Sharded tables require a view")
            current_view = container.client.get_table(text(self.full_name))
            view_sql = current_view.view_query
            shard_name = _extract_primary_shard_name(view_sql)
            try:
                self.shard = container.client.get_table(
                    text(container.full_name + shard_name)
                )
                self._flake = Snowflake.parse(
                    alias_view.schema,
                    text(self.full_name),
                    self.top_level_fields,
                    partition,
                )
            except Exception as e:
                Log.warning("view {{name}} is invalid", name=shard_name, cause=e)
                self._flake = Snowflake.parse(
                    alias_view.schema,
                    text(self.full_name),
                    self.top_level_fields,
                    partition,
                )
                # REMOVE STALE VIEW
                container.client.delete_table(current_view)

                # MAKE NEW VIEW POINTING TO NEW SHARD
                self._create_new_shard()
                container.create_view(
                    self.full_name,
                    self.container.full_name + ApiName(self.shard.table_id),
                )

        self.last_extend = Date.now() - EXTEND_LIMIT
        self.extend_locker = Lock()
        self.extend_queue = Queue("wait for extend")

    def all_records(self):
        """
        MOSTLY FOR TESTING, RETURN ALL RECORDS IN TABLE
        :return:
        """
        return self.sql_query(sql_query({"from": text(self.full_name)}, self.schema))

    def jx_query(self, jx_query):
        docs = self.sql_query(sql_query(dict_to_data({"from": text(self.full_name)}) | jx_query, self.schema))
        data = []
        for d in docs:
            u = untyped(from_data(leaves_to_data(d)))
            data.append(u)

        return Data(data=data, format='list')

    @property
    def schema(self):
        return self._flake

    def sql_query(self, sql):
        """
        :param sql: SQL QUERY
        :return: GENERATOR OF DOCUMENTS as dict
        """
        query_job = self.container.query_and_wait(sql)
        # WE WILL REACH INTO THE _flake, SINCE THIS IS THE FIRST PLACE WE ARE ACTUALLY PULLING RECORDS OUT
        # TODO: WITH MORE CODE THIS LOGIC GOES ELSEWHERE
        _ = self._flake.columns  # ENSURE schema HAS BEEN PROCESSED
        if not self._flake._top_level_fields.keys():
            for row in query_job:
                yield untyped(dict(row))
        else:
            top2deep = {
                name: path for path, name in self._flake._top_level_fields.items()
            }
            for row in query_job:
                output = {}
                doc = dict(row)
                # COPY ALL BUT TOP LEVEL FIELDS
                for k, v in doc.items():
                    deep = top2deep.get(k)
                    if deep is None:
                        output[k] = v
                # INSERT TOP LEVEL FIELDS
                reach = wrap(output)
                for k, p in top2deep.items():
                    try:
                        reach[p] = doc.get(k)
                    except Exception as cause:
                        raise cause
                yield untyped(output)

    @property
    def flake(self):
        return self._flake

    def _create_new_shard(self):
        primary_shard = self.container.create_table(
            table=self.short_name + "_" + "".join(Random.sample(ALLOWED, 20)),
            sharded=False,
            schema=self._flake.schema,
            kwargs=self.config,
        )
        self.shard = primary_shard.shard

    def extend(self, docs):
        self.extend_queue.extend(docs)
        with self.extend_locker:
            docs = self.extend_queue.pop_all()
            if docs:
                self._extend(docs)

    def _extend(self, rows):
        if self.read_only:
            Log.error("not for writing")
        if len(rows) == 0:
            return

        try:
            update = {}
            with Timer("encoding"):
                while True:
                    output = []
                    for rownum, row in enumerate(rows):
                        typed, more, add_nested = typed_encode(row, self.flake)
                        set_default(update, more)
                        if add_nested:
                            # row HAS NEW NESTED COLUMN!
                            # GO OVER THE rows AGAIN SO "RECORD" GET MAPPED TO "REPEATED"
                            DEBUG and Log.note("New nested documnet found, retrying")
                            break
                        output.append(typed)
                    else:
                        break

            if update or not self.shard:
                # BATCH HAS ADDITIONAL COLUMNS!!
                # WE CAN NOT USE THE EXISTING SHARD, MAKE A NEW ONE:
                self._create_new_shard()
                Log.note(
                    "added new shard with name: {{shard}}", shard=self.shard.table_id
                )
            with Timer("insert {{num}} rows to bq", param={"num": len(rows)}):
                failures = self.container.client.insert_rows_json(
                    self.shard,
                    json_rows=output,
                    row_ids=[None] * len(output),
                    skip_invalid_rows=False,
                    ignore_unknown_values=False,
                )
            if failures:
                if all(r == "stopped" for r in wrap(failures).errors.reason):
                    self._create_new_shard()
                    Log.note(
                        "STOPPED encountered: Added new shard with name: {{shard}}",
                        shard=self.shard.table_id,
                    )
                Log.error(
                    "Got {{num}} failures:\n{{failures|json}}",
                    num=len(failures),
                    failures=failures[:5],
                )
            else:
                self.last_extend = Date.now()
                Log.note("{{num}} rows added", num=len(output))
        except Exception as e:
            e = Except.wrap(e)
            if (
                len(output) < 2
                and "Your client has issued a malformed or illegal request." in e
            ):
                Log.error(
                    "big query complains about:\n{{data|json}}",
                    data=output,
                    cause=e
                )
            elif len(rows) > 1 and (
                "Request payload size exceeds the limit" in e
                or "An existing connection was forcibly closed by the remote host" in e
                or "Your client has issued a malformed or illegal request." in e
                or "BrokenPipeError(32, 'Broken pipe')" in e
            ):
                # TRY A SMALLER BATCH
                cut = len(rows) // 2
                self.extend(rows[:cut])
                self.extend(rows[cut:])
                return
            else:
                Log.error("Do not know how to handle", cause=e)

    def add(self, row):
        self.extend([row])

    def merge_shards(self):
        shards = []
        tables = list(self.container.client.list_tables(self.container.dataset))
        current_view = Null  # VIEW THAT POINTS TO PRIMARY SHARD
        primary_shard_name = None  # PRIMARY SHARD
        api_name = escape_name(self.short_name)

        for table_item in tables:
            table = table_item.reference
            table_api_name = ApiName(table.table_id)
            if text(table_api_name).startswith(text(api_name)):
                if table_api_name == api_name:
                    if table_item.table_type != "VIEW":
                        Log.error("expecting {{table}} to be a view", table=api_name)
                    current_view = self.container.client.get_table(table)
                    view_sql = current_view.view_query
                    primary_shard_name = _extract_primary_shard_name(view_sql)
                elif SUFFIX_PATTERN.match(text(table_api_name)[len(text(api_name)) :]):
                    try:
                        known_table = self.container.client.get_table(table)
                        shards.append(known_table)
                    except Exception as e:
                        Log.warning(
                            "could not merge table {{table}}", table=table, cause=e
                        )

        if not current_view:
            Log.error(
                "expecting {{table}} to be a view pointing to a table", table=api_name
            )

        shard_flakes = [
            Snowflake.parse(
                big_query_schema=shard.schema,
                es_index=text(self.container.full_name + ApiName(shard.table_id)),
                top_level_fields=self.top_level_fields,
                partition=self.partition,
            )
            for shard in shards
        ]
        total_flake = snowflakes.merge(
            shard_flakes,
            es_index=text(self.full_name),
            top_level_fields=self.top_level_fields,
            partition=self.partition,
        )

        for i, s in enumerate(shards):
            if ApiName(s.table_id) == primary_shard_name:
                if total_flake == shard_flakes[i]:
                    # USE THE CURRENT PRIMARY SHARD AS A DESTINATION
                    del shards[i]
                    del shard_flakes[i]
                    break
        else:
            name = self.short_name + "_" + "".join(Random.sample(ALLOWED, 20))
            primary_shard_name = escape_name(name)
            self.container.create_table(
                table=name,
                schema=total_flake.schema,
                sharded=False,
                read_only=False,
                kwargs=self.config,
            )

        primary_full_name = self.container.full_name + primary_shard_name

        selects = []
        for flake, table in zip(shard_flakes, shards):
            q = ConcatSQL(
                SQL_SELECT,
                JoinSQL(ConcatSQL(SQL_COMMA, SQL_CR), gen_select(total_flake, flake)),
                SQL_FROM,
                quote_column(ApiName(table.dataset_id, table.table_id)),
            )
            selects.append(q)

        Log.note("inserting into table {{table}}", table=text(primary_shard_name))
        matched = []
        unmatched = []
        for sel, shard, flake in zip(selects, shards, shard_flakes):
            if flake == total_flake:
                matched.append((sel, shard, flake))
            else:
                unmatched.append((sel, shard, flake))

        # EVERYTHING THAT IS IDENTICAL TO PRIMARY CAN BE MERGED WITH SIMPLE UNION ALL
        if matched:
            for g, merge_chunk in jx.chunk(matched, MAX_MERGE):
                command = ConcatSQL(
                    SQL_INSERT,
                    quote_column(primary_full_name),
                    JoinSQL(
                        SQL_UNION_ALL,
                        (
                            sql_query(
                                {
                                    "from": text(self.container.full_name + ApiName(shard.table_id))
                                },
                                schema
                            )
                            for _, shard, schema in merge_chunk
                        ),
                    ),
                )
                DEBUG and Log.note("{{sql}}", sql=text(command))
                job = self.container.query_and_wait(command)
                Log.note("job {{id}} state = {{state}}", id=job.job_id, state=job.state)

                if job.errors:
                    Log.error(
                        "\n{{sql}}\nDid not fill table:\n{{reason|json|indent}}",
                        sql=command.sql,
                        reason=job.errors,
                    )
                for _, shard, _ in merge_chunk:
                    self.container.client.delete_table(shard)

        # ALL OTHER SCHEMAS MISMATCH
        for s, shard, _ in unmatched:
            try:
                command = ConcatSQL(SQL_INSERT, quote_column(primary_full_name), s)
                DEBUG and Log.note("{{sql}}", sql=text(command))
                job = self.container.query_and_wait(command)
                Log.note(
                    "from {{shard}}, job {{id}}, state {{state}}",
                    id=job.job_id,
                    shard=shard.table_id,
                    state=job.state,
                )

                if job.errors:
                    if all(
                        " does not have a schema." in m
                        for m in wrap(job.errors).message
                    ):
                        pass  # NOTHING TO DO
                    else:
                        Log.error(
                            "\n{{sql}}\nDid not fill table:\n{{reason|json|indent}}",
                            sql=command.sql,
                            reason=job.errors,
                        )

                self.container.client.delete_table(shard)
            except Exception as e:
                Log.warning("failure to merge {{shard}}", shard=shard, cause=e)

        # REMOVE OLD VIEW
        view_full_name = self.container.full_name + api_name
        if current_view:
            self.container.client.delete_table(current_view)

        # CREATE NEW VIEW
        self.container.create_view(view_full_name, primary_full_name)

    def condense(self):
        """
        :return:
        """
        # MAKE NEW SHARD
        partition = JoinSQL(
            SQL_COMMA,
            [
                quote_column(c.es_field)
                for f in listwrap(self.id.field)
                for c in self.flake.leaves(f)
            ],
        )
        order_by = JoinSQL(
            SQL_COMMA,
            [
                ConcatSQL(quote_column(c.es_field), SQL_DESC)
                for f in listwrap(self.id.version)
                for c in self.flake.leaves(f)
            ],
        )
        # WRAP WITH etl.timestamp BEST SELECTION

        self.container.query_and_wait(
            ConcatSQL(
                SQL(  # SOME KEYWORDS: ROWNUM RANK
                    "SELECT * EXCEPT (_rank) FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY "
                ),
                partition,
                SQL_ORDERBY,
                order_by,
                SQL(") AS _rank FROM "),
                quote_column(self.full_name),
                SQL(") a WHERE _rank=1"),
            )
        )


def _extract_primary_shard_name(view_sql):
    # TODO: USE REAL PARSER
    e = view_sql.lower().find("from ")
    return ApiName(view_sql[e + 5 :].strip().split(".")[-1].strip("`"))


def gen_select(total_flake, flake):
    """
    GENERATE SELECT CLAUSE
    :param total_flake:  THE DESTINATION SCHEMA TO MATCH
    :param flake:  THE SCHEMA SELECTING FROM
    :return:  SQL
    """

    def _gen_select(
        source_path, source_tops, source_flake, total_path, total_tops, total_flake
    ):
        if total_flake == source_flake and not total_tops:
            return [
                quote_column(source_path + escape_name(k))
                for k in jx.sort(total_flake.keys())
            ]

        if NESTED_TYPE in total_flake:
            # PROMOTE EVERYTHING TO REPEATED
            v = source_flake.get(NESTED_TYPE)
            t = total_flake.get(NESTED_TYPE)

            if not v:
                # CONVERT INNER OBJECT TO ARRAY OF ONE STRUCT
                inner = [
                    ConcatSQL(
                        SQL_SELECT_AS_STRUCT,
                        JoinSQL(
                            ConcatSQL(SQL_COMMA, SQL_CR),
                            _gen_select(
                                source_path,
                                Null,
                                source_flake,
                                total_path + REPEATED,
                                Null,
                                t,
                            ),
                        ),
                    )
                ]
            else:
                row_name = "row" + text(len(source_path.values))
                ord_name = "ordering" + text(len(source_path.values))
                inner = [
                    ConcatSQL(
                        SQL_SELECT_AS_STRUCT,
                        JoinSQL(
                            ConcatSQL(SQL_COMMA, SQL_CR),
                            _gen_select(
                                ApiName(row_name), Null, v, ApiName(row_name), Null, t
                            ),
                        ),
                        SQL_FROM,
                        sql_call("UNNEST", quote_column(source_path + REPEATED)),
                        SQL_AS,
                        SQL(row_name),
                        SQL(" WITH OFFSET AS "),
                        SQL(ord_name),
                        SQL_ORDERBY,
                        SQL(ord_name),
                    )
                ]

            return [sql_alias(sql_call("ARRAY", *inner), REPEATED)]

        selection = []
        for k, t in jx.sort(total_flake.items(), 0):
            k_total_tops = total_tops if is_text(total_tops) else total_tops[k]
            k_tops = source_tops if is_text(source_tops) else source_tops[k]
            v = source_flake.get(k)
            if is_text(k_total_tops):
                # DO NOT INCLUDE TOP_LEVEL_FIELDS
                pass
            elif t == v and not k_total_tops and not k_tops:
                selection.append(
                    ConcatSQL(
                        quote_column(source_path + escape_name(k)),
                        SQL_AS,
                        quote_column(escape_name(k)),
                    )
                )
            elif is_data(t):
                if not v:
                    selects = _gen_select(
                        source_path + escape_name(k),
                        source_tops,
                        {},
                        total_path + escape_name(k),
                        k_total_tops,
                        t,
                    )
                elif is_data(v):
                    selects = _gen_select(
                        source_path + escape_name(k),
                        source_tops,
                        v,
                        total_path + escape_name(k),
                        k_total_tops,
                        t,
                    )
                else:
                    raise Log.error(
                        "Datatype mismatch on {{field}}: Can not merge {{type}} into {{main}}",
                        field=join_field(source_path + escape_name(k)),
                        type=v,
                        main=t,
                    )
                if selects:
                    inner = [
                        ConcatSQL(
                            SQL_SELECT_AS_STRUCT,
                            JoinSQL(ConcatSQL(SQL_COMMA, SQL_CR), selects),
                        )
                    ]
                    selection.append(sql_alias(sql_call("", *inner), escape_name(k)))
            elif is_text(t):
                if is_text(k_tops):
                    # THE SOURCE HAS THIS PROPERTY AS A TOP_LEVEL_FIELD
                    selection.append(
                        ConcatSQL(SQL(k_tops), SQL_AS, quote_column(escape_name(k)))
                    )
                elif v == t:
                    selection.append(
                        ConcatSQL(
                            quote_column(total_path + escape_name(k)),
                            SQL_AS,
                            quote_column(escape_name(k)),
                        )
                    )
                else:
                    if v:
                        Log.note(
                            "Datatype mismatch on {{field}}: Can not merge {{type}} into {{main}}",
                            field=join_field(source_path + escape_name(k)),
                            type=v,
                            main=t,
                        )
                    selection.append(
                        ConcatSQL(
                            sql_call(
                                "CAST",
                                ConcatSQL(
                                    SQL_NULL, SQL_AS, SQL(json_type_to_bq_type[t])
                                ),
                            ),
                            SQL_AS,
                            quote_column(escape_name(k)),
                        )
                    )
            else:
                Log.error("not expected")
        return selection

    output = _gen_select(
        ApiName(),
        flake.top_level_fields,
        flake.schema,
        ApiName(),
        total_flake.top_level_fields,
        total_flake.schema,
    )
    tops = []

    for path, name in jx.sort(total_flake.top_level_fields.leaves(), 0):
        source = flake.top_level_fields[path]
        if source:
            # ALREADY TOP LEVEL FIELD
            source = SQL(source)
        else:
            # PULL OUT TOP LEVEL FIELD
            column = first(flake.leaves(path))
            source = SQL(column.es_column)

        tops.append(ConcatSQL(source, SQL_AS, quote_column(ApiName(name))))

    return tops + output


DEFAULT_SCHEMA = {"_id": INTEGER}
DEFAULT_TYPED_SCHEMA = {"_id": {INTEGER_TYPE: INTEGER}}
