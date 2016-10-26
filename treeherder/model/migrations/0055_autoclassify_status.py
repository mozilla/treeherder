# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models

# Original SQL:
#
# BEGIN;
# --
# -- Add field autoclassify_status to job
# --
# ALTER TABLE `job` ADD COLUMN `autoclassify_status` integer DEFAULT 0 NOT NULL;
# ALTER TABLE `job` ALTER COLUMN `autoclassify_status` DROP DEFAULT;
# COMMIT;


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0054_duplicate_failure_classifications'),
    ]

    operations = [migrations.RunSQL(
        sql="""
--
-- Add field autoclassify_status to job
--
SET FOREIGN_KEY_CHECKS=0;
ALTER TABLE `job` ADD COLUMN `autoclassify_status` integer DEFAULT 0 NOT NULL;
ALTER TABLE `job` ALTER COLUMN `autoclassify_status` DROP DEFAULT;
""",
        reverse_sql="""
--
-- Add field autoclassify_status to job
--
ALTER TABLE `job` DROP COLUMN `autoclassify_status` CASCADE;
""",
        state_operations = [
            migrations.AddField(
                model_name='job',
                name='autoclassify_status',
                field=models.IntegerField(default=0, choices=[(0, 'pending'), (1, 'crossreferenced'), (2, 'autoclassified'), (3, 'skipped'), (255, 'failed')]),
            ),
        ])]
