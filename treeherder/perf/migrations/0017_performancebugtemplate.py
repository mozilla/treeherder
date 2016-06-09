# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('perf', '0016_manually_created_alerts'),
    ]

    operations = [
        migrations.CreateModel(
            name='PerformanceBugTemplate',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('keywords', models.CharField(max_length=255)),
                ('status_whiteboard', models.CharField(max_length=255)),
                ('default_component', models.CharField(max_length=255)),
                ('default_product', models.CharField(max_length=255)),
                ('cc_list', models.CharField(max_length=255)),
                ('text', models.TextField(max_length=4096)),
                ('framework', models.OneToOneField(to='perf.PerformanceFramework')),
            ],
            options={
                'db_table': 'performance_bug_template',
            },
        ),
    ]
