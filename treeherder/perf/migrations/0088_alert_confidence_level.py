from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("perf", "0087_performancesignature_detection_techniques"),
    ]

    operations = [
        migrations.AddField(
            model_name="performancealert",
            name="confidence_level",
            field=models.CharField(
                choices=[
                    ("very low", "Very low"),
                    ("low", "Low"),
                    ("medium", "Medium"),
                    ("high", "High"),
                ],
                default=None,
                max_length=10,
                null=True,
            ),
        ),
    ]
