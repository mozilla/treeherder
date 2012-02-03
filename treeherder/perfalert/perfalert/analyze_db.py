# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
import sqlalchemy as sa
from sqlalchemy.ext.sqlsoup import SqlSoup

from analyze import PerfDatum

import logging as log

class TestSeries:
    def __init__(self, branch_id, branch_name, os_id, os_name, test_id, test_name, test_shortname):
        self.branch_id = branch_id
        self.branch_name = branch_name
        self.os_id = os_id
        self.os_name = os_name
        self.test_id = test_id
        self.test_name = test_name
        self.test_shortname = test_shortname

    def __eq__(self, o):
        return (self.branch_id, self.os_id, self.test_id) == (o.branch_id, o.os_id, o.test_id)

    def __hash__(self):
        return hash((self.branch_id, self.os_id, self.test_id))

    def __str__(self):
        return "%s %s %s" % (self.branch_name, self.os_name, self.test_shortname)

db = None
goodNameClause = None


def connect(url):
    global db
    db = SqlSoup(url)

    global goodNameClause
    goodNameClause = db.machines.is_active == 1


def getTestData(series, start_time):
    q = sa.select(
        [db.test_runs.id, db.test_runs.machine_id, db.builds.ref_build_id,
            db.test_runs.date_run, db.test_runs.average,
            db.builds.ref_changeset, db.test_runs.run_number,
            db.builds.branch_id],
        sa.and_(
        db.test_runs.test_id == series.test_id,
        db.builds.branch_id == series.branch_id,
        db.machines.os_id == series.os_id,
        db.test_runs.machine_id == db.machines.id,
        db.test_runs.build_id == db.builds.id,
        db.test_runs.date_run > start_time,
        goodNameClause,
        sa.not_(db.machines.name.like("%stage%")),
        ))

    data = []
    for row in q.execute():
        if row.average is None:
            continue
        t = row.date_run
        d = PerfDatum(row.id, row.machine_id, row.date_run, row.average, row.ref_build_id, t, row.ref_changeset)
        d.run_number = row.run_number
        data.append(d)
    return data

def getTestSeries(branches, start_date, test_names, last_run=None):
    # Find all the Branch/OS/Test combinations
    if len(test_names) > 0:
        test_clause = db.tests.pretty_name.in_(test_names)
    else:
        test_clause = True
    q = sa.select(
            [db.branches.id.label('branch_id'), db.branches.name.label('branch_name'), db.os_list.id.label('os_id'), db.os_list.name.label('os_name'), db.tests.id.label('test_id'), db.tests.pretty_name, db.tests.name.label('test_name')],
            sa.and_(
                db.test_runs.machine_id == db.machines.id,
                db.builds.id == db.test_runs.build_id,
                db.os_list.id == db.machines.os_id,
                db.tests.id == db.test_runs.test_id,
                db.test_runs.date_run > start_date,
                db.branches.name.in_(branches),
                goodNameClause,
                sa.not_(db.machines.name.like('%stage%')),
                sa.or_(db.branches.name.startswith('mobile'), sa.not_(db.tests.pretty_name.like("%NoChrome%"))),
                sa.not_(db.tests.pretty_name.like("%Fast Cycle%")),
                test_clause,
            ))

    if last_run:
        q = q.where(db.test_runs.id > last_run)
    q = q.distinct()

    retval = []
    for row in q.execute():
        retval.append(TestSeries(*row))
    return retval


_machines_cache = {}


def getMachinesForTest(series):
    key = (series.os_id, series.branch_id, series.test_id)
    if key in _machines_cache:
        return _machines_cache[key]

    q = sa.select([db.machines.id], sa.and_(
        db.test_runs.machine_id == db.machines.id,
        db.builds.id == db.test_runs.build_id,
        db.builds.branch_id == series.branch_id,
        db.tests.id == db.test_runs.test_id,
        db.tests.id == series.test_id,
        db.machines.os_id == series.os_id,
        goodNameClause,
        sa.not_(db.machines.name.like('%stage%')),
        )).distinct()
    result = q.execute()

    _machines_cache[key] = [row[0] for row in result.fetchall()]
    return _machines_cache[key]


_name_cache = {}


def getMachineName(machine_id):
    if machine_id in _name_cache:
        return _name_cache[machine_id]

    m = db.machines.filter_by(id=machine_id).one()
    if m:
        _name_cache[machine_id] = m.name
        return m.name
    else:
        _name_cache[machine_id] = None
        return None

def getInactiveMachines(statusdb_url, initial_time, start_time, end_time):
    """Returns a list of slave machines that have been active between
    initial_time and end_time, but haven't been active between start_time and
    end_time"""
    db = SqlSoup(statusdb_url)

    q = sa.select([db.slaves.id, db.slaves.name], sa.and_(
        sa.not_(sa.exists(
            sa.select([db.builds.slave_id], sa.and_(
                db.builds.starttime >= start_time,
                db.builds.endtime <= end_time,
                db.builds.slave_id == db.slaves.id,
                )))),
        sa.exists(
            sa.select([db.builds.slave_id], sa.and_(
                db.builds.starttime >= initial_time,
                db.builds.starttime <= end_time,
                db.builds.slave_id == db.slaves.id,
                )))
        ))

    return [row['name'] for row in q.execute()]
