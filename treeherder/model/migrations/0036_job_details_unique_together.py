# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0035_job_detail_field_lengths_decrease'),
    ]

    operations = [
        migrations.RunSQL(
            # Using ALTER IGNORE so that it will automatically delete duplicates
            ("ALTER IGNORE TABLE `job_detail` ADD CONSTRAINT "
             "`job_detail_title_11a9e7f847f5214c_uniq` "
             "UNIQUE (`title`, `value`, `job_id`);"),
            state_operations=[
                migrations.AlterUniqueTogether(
                    name='jobdetail',
                    unique_together=set([('title', 'value', 'job')]),
                ),
            ],
        ),
    ]
