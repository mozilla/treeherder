# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0039_push_and_commit_orm'),
    ]

    operations = [
        migrations.AlterField(
            model_name='job',
            name='push',
            field=models.ForeignKey(to='model.Push'),
        ),
    ]
