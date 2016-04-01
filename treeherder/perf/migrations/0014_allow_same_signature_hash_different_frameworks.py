# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('perf', '0013_add_has_subtests_property'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='performancesignature',
            unique_together=set([('repository', 'framework', 'signature_hash')]),
        ),
    ]
