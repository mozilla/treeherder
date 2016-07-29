# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0036_auto_20160721_1152'),
    ]

    operations = [
        migrations.AlterField(
            model_name='textlogstep',
            name='finished',
            field=models.DateTimeField(null=True),
        ),
        migrations.AlterField(
            model_name='textlogstep',
            name='result',
            field=models.IntegerField(choices=[(0, 'success'), (1, 'testfailed'), (2, 'busted'), (3, 'skipped'), (4, 'exception'), (5, 'retry'), (6, 'usercancel'), (7, 'unknown')]),
        ),
        migrations.AlterField(
            model_name='textlogstep',
            name='started',
            field=models.DateTimeField(null=True),
        ),
    ]
