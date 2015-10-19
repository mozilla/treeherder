# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0006_remove_description_default_of_fillme'),
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
