# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations
import treeherder.model.fields


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0002_auto_20151014_0900'),
    ]

    operations = [
        migrations.AlterField(
            model_name='failurematch',
            name='classified_failure',
            field=treeherder.model.fields.FlexibleForeignKey(related_name='matches', to='model.ClassifiedFailure'),
        ),
    ]
