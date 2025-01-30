import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def set_internal_fks(apps, schema_editor):
    """
    Initally set the internal ID as the same as Bugzilla ID.
    This is not reversible as once internal issues will be
    created internal ID and Bugzilla ID should be out of sync.
    """
    BugJobMap = apps.get_model("model", "BugJobMap")
    BugJobMap.objects.all().update(bug_id=models.F("bugzilla_id"))

class Migration(migrations.Migration):

    dependencies = [
        ("model", "0035_bugscache_optional_bugzilla_ref"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Allow access to custom manager inside the migration
        migrations.AlterModelManagers(
            name='bugjobmap',
            managers=[
                ('objects', models.Manager()),
            ],
        ),
        migrations.DeleteModel(
            name="BugscacheOccurrence",
        ),
        migrations.AlterField(
            model_name="bugjobmap",
            name="created",
            field=models.DateTimeField(auto_now_add=True),
        ),
        migrations.AlterUniqueTogether(
            name="bugjobmap",
            unique_together=set(),
        ),
        migrations.RenameField(
            model_name="bugjobmap",
            old_name="bug_id",
            new_name="bugzilla_id"
        ),
        migrations.AddField(
            model_name="bugjobmap",
            name="bug",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="jobmap",
                to="model.bugscache",
            ),
        ),
        migrations.RunPython(
            set_internal_fks,
        ),
        migrations.AlterField(
            model_name="bugjobmap",
            name="bug",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="jobmap",
                to="model.bugscache",
            ),
        ),
        migrations.AddConstraint(
            model_name="bugjobmap",
            constraint=models.UniqueConstraint(
                fields=("job", "bug"), name="unique_job_bug_mapping"
            ),
        ),
        migrations.RemoveField(
            model_name="bugjobmap",
            name="bugzilla_id",
        ),
        migrations.AlterModelManagers(
            name="bugjobmap",
            managers=[
                ("failures", django.db.models.manager.Manager()),
            ],
        ),
    ]
