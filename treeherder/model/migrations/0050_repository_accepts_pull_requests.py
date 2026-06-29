from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("model", "0049_repository_branch_model"),
    ]

    operations = [
        migrations.AddField(
            model_name="repository",
            name="accepts_pull_requests",
            field=models.BooleanField(default=False, db_index=True),
        ),
    ]
