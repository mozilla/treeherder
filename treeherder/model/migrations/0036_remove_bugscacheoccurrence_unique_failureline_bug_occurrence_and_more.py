import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("model", "0035_bugscache_optional_bugzilla_ref"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="bugscacheoccurrence",
            name="unique_failureline_bug_occurrence",
        ),
        migrations.RemoveField(
            model_name="bugscacheoccurrence",
            name="failure_line",
        ),
        migrations.AddField(
            model_name="bugscacheoccurrence",
            name="text_log_error",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="bug_occurrences",
                to="model.textlogerror",
            ),
        ),
        migrations.AddConstraint(
            model_name="bugscacheoccurrence",
            constraint=models.UniqueConstraint(
                fields=("text_log_error", "bug"),
                name="unique_text_log_error_bug_occurrence",
            ),
        ),
    ]
