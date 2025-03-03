from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("model", "0038_commit_search_vector_idx"),
    ]

    operations = [
        migrations.RunSQL("SELECT SETVAL('bugscache_id_seq', (SELECT MAX(bugzilla_id) FROM bugscache))")
    ]
