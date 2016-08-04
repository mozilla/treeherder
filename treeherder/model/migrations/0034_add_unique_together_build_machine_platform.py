# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0033_add_branch_field_to_repository'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='buildplatform',
            unique_together=set([('os_name', 'platform', 'architecture')]),
        ),
        migrations.AlterUniqueTogether(
            name='machineplatform',
            unique_together=set([('os_name', 'platform', 'architecture')]),
        ),
    ]
