# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('perf', '0021_push_and_commit_orm'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='performancealertsummary',
            unique_together=set([('repository', 'framework', 'prev_push', 'push'), ('repository', 'framework', 'prev_result_set_id', 'result_set_id')]),
        ),
    ]
