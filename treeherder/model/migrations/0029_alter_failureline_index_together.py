# Generated by Django 4.1.9 on 2023-08-28 11:32

from django.db import migrations


class Migration(migrations.Migration):
    """
    Drop indices on the Failure Line table as test and subtest
    entries are too large compared to PostgreSQL limitations.
    https://www.postgresql.org/docs/15/textsearch-limitations.html
    """

    dependencies = [
        ('model', '0028_alter_textlogerror_unique_together'),
    ]

    operations = [
    ]
