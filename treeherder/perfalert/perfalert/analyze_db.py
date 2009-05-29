from graphsdb import db

from analyze import PerfDatum

def getTestData(branch_id, os_id, test_id, start_date):
    cursor = db.cursor()
    sql = """SELECT
        machine_id,
        ref_build_id,
        date_run,
        average,
        ref_changeset
    FROM
        test_runs INNER JOIN machines ON (machine_id = machines.id)
            INNER JOIN builds ON (build_id = builds.id)
    WHERE
        test_id = %(test_id)s AND
        os_id = %(os_id)s AND
        branch_id = %(branch_id)s AND
        date_run > %(start_date)s AND
        machines.name NOT LIKE '%%stage%%'
    """
    cursor.execute(sql, locals())
    data = []
    for row in cursor:
        machine_id, ref_build_id, date_run, average, ref_changeset = row
        if average is None:
            continue
        t = date_run
        d = PerfDatum(machine_id, date_run, average, ref_build_id, t, ref_changeset)
        data.append(d)
    return data

def getTestSeries(branches, start_date, test_names):
    # Find all the Branch/OS/Test combinations
    branch_places = ",".join(["%s"] * len(branches))
    test_places = ",".join(["%s"] * len(test_names))
    sql = """SELECT DISTINCT 
        branch_id,
        branches.name AS branch_name,
        os_id,
        os_list.name AS os_name,
        test_id,
        tests.name AS test_name
    FROM
         test_runs INNER JOIN machines ON (machine_id = machines.id)
            INNER JOIN builds ON (build_id = builds.id)
            INNER JOIN branches ON (branch_id = branches.id)
            INNER JOIN os_list ON (os_id = os_list.id)
            INNER JOIN tests ON (test_id = tests.id)
    WHERE
        date_run > %%s AND
        branches.name IN (%(branch_places)s) AND
        machines.name NOT LIKE '%%%%stage%%%%'
    """
    if len(test_names) > 0:
        sql += "AND tests.name IN (%(test_places)s)"
    sql = sql % locals()

    cursor = db.cursor()
    args = [start_date] + branches + test_names
    cursor.execute(sql, args)
    return cursor.fetchall()

def getMachinesForTest(branch_id, test_id, os_id):
    sql = """SELECT DISTINCT
        machine_id
    FROM
        test_runs INNER JOIN machines ON (machine_id = machines.id)
            INNER JOIN tests ON (test_id = tests.id)
            INNER JOIN builds ON (build_id = builds.id)
    WHERE
        branch_id = %(branch_id)s AND
        test_id = %(test_id)s AND
        os_id = %(os_id)s AND
        machines.name NOT LIKE '%%stage%%'
    """
    cursor = db.cursor()
    cursor.execute(sql, locals())
    return [row[0] for row in cursor.fetchall()]

def getMachineName(machine_id):
    sql = """SELECT 
        name
    FROM
        machines
    WHERE
        id = %(machine_id)s
    """
    cursor = db.cursor()
    cursor.execute(sql, locals())
    return cursor.fetchall()[0][0]

