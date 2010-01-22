import sys
import sqlalchemy as sa
from sqlalchemy.ext.sqlsoup import SqlSoup

from analyze import PerfDatum
from analyze_graphapi import TestSeries

db = None
def connect(url):
    global db
    db = SqlSoup(url)

def getTestData(series, start_time):
    q = sa.select(
        [db.test_runs.machine_id, db.builds.ref_build_id, db.test_runs.date_run, db.test_runs.average, db.builds.ref_changeset, db.test_runs.run_number, db.builds.branch_id],
        sa.and_(
        db.test_runs.test_id == series.test_id,
        db.builds.branch_id == series.branch_id,
        db.machines.os_id == series.os_id,
        db.test_runs.machine_id == db.machines.id,
        db.test_runs.build_id == db.builds.id,
        db.test_runs.date_run > start_time,
        sa.not_(db.machines.name.like('talos-r3%')),
        sa.not_(db.machines.name.like("%stage%")),
        ))

    data = []
    for row in q.execute():
        if row.average is None:
            continue
        t = row.date_run
        d = PerfDatum(row.machine_id, row.date_run, row.average, row.ref_build_id, t, row.ref_changeset)
        d.run_number = row.run_number
        data.append(d)
    return data

def getTestSeries(branches, start_date, test_names):
    # Find all the Branch/OS/Test combinations
    if len(test_names) > 0:
        test_clause = db.tests.pretty_name.in_(test_names)
    else:
        test_clause = True
    q = sa.select(
            [db.branches.id, db.branches.name, db.os_list.id, db.os_list.name, db.tests.id, db.tests.pretty_name],
            sa.and_(
                db.test_runs.machine_id == db.machines.id,
                db.builds.id == db.test_runs.build_id,
                db.os_list.id == db.machines.os_id,
                db.tests.id == db.test_runs.test_id,
                db.test_runs.date_run > start_date,
                db.branches.name.in_(branches),
                sa.not_(db.machines.name.like('talos-r3%')),
                sa.not_(db.machines.name.like('%stage%')),
                sa.not_(db.tests.pretty_name.like("%NoChrome%")),
                sa.not_(db.tests.pretty_name.like("%Fast Cycle%")),
                test_clause
            ))

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
        sa.not_(db.machines.name.like('talos-r3%')),
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
