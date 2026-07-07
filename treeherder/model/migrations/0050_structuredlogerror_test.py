from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("model", "0049_structuredlogerror"),
    ]

    operations = [
        migrations.AddField(
            model_name="structuredlogerror",
            name="test",
            field=models.CharField(blank=True, max_length=512),
        ),
    ]
