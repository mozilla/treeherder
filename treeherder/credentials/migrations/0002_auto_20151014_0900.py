# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('credentials', '0001_initial'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='credentials',
            options={'verbose_name_plural': 'credentials'},
        ),
        migrations.AlterField(
            model_name='credentials',
            name='client_id',
            field=models.SlugField(unique=True, max_length=32, verbose_name=b'client ID'),
        ),
    ]
