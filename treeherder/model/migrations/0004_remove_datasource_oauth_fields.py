# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0003_auto_20151111_0942'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='datasource',
            name='oauth_consumer_key',
        ),
        migrations.RemoveField(
            model_name='datasource',
            name='oauth_consumer_secret',
        ),
    ]
