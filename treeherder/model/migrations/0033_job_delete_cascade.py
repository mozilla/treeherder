# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import django.db.models.deletion
import treeherder.model.fields


def db_func(direction, table, apps, schema_editor):
    assert direction in ("forward", "reverse")
    cursor = schema_editor.connection.cursor()
    cursor.execute("""SELECT CONSTRAINT_NAME
                        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                        WHERE
                          REFERENCED_TABLE_SCHEMA = 'treeherder' AND
                          TABLE_NAME = %s AND
                          REFERENCED_TABLE_NAME = 'job'""", [table])

    fk_row = cursor.fetchone()
    if fk_row:
        fk_name = fk_row[0]
        try:
            cursor.execute("""ALTER TABLE %s DROP FOREIGN KEY %s""" % (table, fk_name))
        except:
            pass

    cursor.execute("""ALTER TABLE %s
                        ADD CONSTRAINT %s_fk_job_id
                        FOREIGN KEY (`job_id`)
                        REFERENCES `job` (`id`)
                        %s;""" % (table, table, "ON DELETE CASCADE" if direction == "forward" else ""))


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0032_bugjobmap_jobnote_models'),
    ]

    operations = [
        migrations.AlterField(
            model_name='bugjobmap',
            name='job',
            field=treeherder.model.fields.FlexibleForeignKey(to='model.Job', on_delete=django.db.models.deletion.DO_NOTHING),
        ),

        migrations.AlterField(
            model_name='jobdetail',
            name='job',
            field=treeherder.model.fields.FlexibleForeignKey(to='model.Job', on_delete=django.db.models.deletion.DO_NOTHING),
        ),

        migrations.AlterField(
            model_name='joblog',
            name='job',
            field=treeherder.model.fields.FlexibleForeignKey(to='model.Job', on_delete=django.db.models.deletion.DO_NOTHING),
        ),

        migrations.AlterField(
            model_name='jobnote',
            name='job',
            field=treeherder.model.fields.FlexibleForeignKey(to='model.Job', on_delete=django.db.models.deletion.DO_NOTHING),
        ),

        migrations.RunPython(lambda x,y: db_func("forward", "bug_job_map", x, y),
                             lambda x,y: db_func("reverse", "bug_job_map", x, y),
                             atomic=False),

        migrations.RunPython(lambda x,y: db_func("forward", "job_detail", x, y),
                             lambda x,y: db_func("reverse", "job_detail", x, y),
                             atomic=False),

        migrations.RunPython(lambda x,y: db_func("forward", "job_log", x, y),
                             lambda x,y: db_func("reverse", "job_log", x, y),
                             atomic=False),

        migrations.RunPython(lambda x,y: db_func("forward", "job_note", x, y),
                             lambda x,y: db_func("reverse", "job_note", x, y),
                             atomic=False),

    ]
