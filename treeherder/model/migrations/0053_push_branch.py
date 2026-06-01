from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("model", "0052_bugscache_summary_gin_trgm_index"),
    ]

    operations = [
        migrations.AddField(
            model_name="push",
            name="branch",
            field=models.CharField(blank=True, default=None, max_length=255, null=True),
        ),
    ]
