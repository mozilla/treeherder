import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("model", "0048_alter_failureline_action"),
    ]

    operations = [
        migrations.AddField(
            model_name="repository",
            name="git_url",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="repository",
            name="git_branch",
            field=models.CharField(
                blank=True, default="main", max_length=255, null=True
            ),
        ),
        migrations.CreateModel(
            name="RevisionMapping",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("hg_revision", models.CharField(db_index=True, max_length=40)),
                ("git_revision", models.CharField(db_index=True, max_length=40)),
                (
                    "repository",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to="model.repository",
                    ),
                ),
            ],
            options={
                "db_table": "revision_mapping",
                "unique_together": {("repository", "hg_revision")},
                "indexes": [
                    models.Index(
                        fields=["repository", "git_revision"],
                        name="revmap_repo_git_idx",
                    ),
                ],
            },
        ),
    ]
