import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.utils import timezone


def set_internal_fks(apps, schema_editor):
    """
    Reference FK from BugJobMap to Bugscache instead of just the Bugzilla ID as integer.
    This is required to support creating internal issues without publishing to Bugzilla.
    """
    BugJobMap = apps.get_model("model", "BugJobMap")
    Bugscache = apps.get_model("model", "Bugscache")
    now = timezone.now()
    created_count = 0
    for bug_job_map in BugJobMap.objects.only("id", "bugzilla_id").iterator():
        # Create eventually missing Bugscache entries
        bugscache, created = Bugscache.objects.get_or_create(
            bugzilla_id=bug_job_map.bugzilla_id,
            defaults={
                "modified": now,
                "summary": "(no bug data fetched)",
            }
        )
        created_count += created
        bug_job_map.bug_id = bugscache.id
        bug_job_map.save()
    if created_count:
        print(f"Created {created_count} missing Bugscache entries referenced via BugJobMap")

class Migration(migrations.Migration):

    dependencies = [
        ("model", "0036_bugscache_init_autoincrement"),
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
