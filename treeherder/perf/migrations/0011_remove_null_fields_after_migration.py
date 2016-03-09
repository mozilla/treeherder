# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('perf', '0010_add_alertsummary_backed_out'),
    ]

    operations = [
        migrations.AlterField(
            model_name='performancesignature',
            name='last_updated',
            field=models.DateTimeField(db_index=True),
        ),
        migrations.AlterField(
            model_name='performancesignature',
            name='repository',
            field=models.ForeignKey(to='model.Repository'),
        ),
    ]
