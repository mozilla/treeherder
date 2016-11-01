# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0038_text_log_db'),
    ]

    operations = [
        migrations.CreateModel(
            name='Commit',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('revision', models.CharField(max_length=40)),
                ('author', models.CharField(max_length=150)),
                ('comments', models.TextField()),
            ],
            options={
                'db_table': 'commit',
            },
        ),
        migrations.CreateModel(
            name='Push',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('revision_hash', models.CharField(max_length=50, null=True)),
                ('revision', models.CharField(max_length=40, null=True)),
                ('author', models.CharField(max_length=150)),
                ('timestamp', models.DateTimeField()),
                ('repository', models.ForeignKey(to='model.Repository')),
            ],
            options={
                'db_table': 'push',
            },
        ),
        migrations.AddField(
            model_name='commit',
            name='push',
            field=models.ForeignKey(related_name='commits', to='model.Push'),
        ),
        migrations.AddField(
            model_name='job',
            name='push',
            field=models.ForeignKey(to='model.Push', null=True),
        ),
        migrations.AlterUniqueTogether(
            name='push',
            unique_together=set([('repository', 'revision_hash'), ('repository', 'revision')]),
        ),
        migrations.AlterUniqueTogether(
            name='commit',
            unique_together=set([('push', 'revision')]),
        ),
    ]
