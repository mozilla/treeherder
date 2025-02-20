from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("model", "0035_bugscache_optional_bugzilla_ref"),
    ]

    operations = [
        migrations.RunSQL("SELECT SETVAL('bugscache_id_seq', (SELECT MAX(id) FROM bugscache))")
    ]
