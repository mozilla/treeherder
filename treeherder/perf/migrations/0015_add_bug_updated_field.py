# Generated by Django 2.1.7 on 2019-03-20 09:48

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('perf', '0014_add_performance_datum_idx'),
    ]

    operations = [
        migrations.AddField(
            model_name='performancealertsummary',
            name='bug_updated',
            field=models.DateTimeField(null=True),
        ),
    ]
