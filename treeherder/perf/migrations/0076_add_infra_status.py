from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("perf", "0075_performancealertsummary_bug_status"),
    ]

    operations = [
        migrations.AlterField(
            model_name="performancealert",
            name="status",
            field=models.IntegerField(
                choices=[
                    (0, "Untriaged"),
                    (1, "Downstream"),
                    (2, "Reassigned"),
                    (3, "Invalid"),
                    (4, "Acknowledged"),
                    (5, "Infra"),
                ],
                default=0
            ),
        ),
        migrations.AlterField(
            model_name="performancealerttesting",
            name="status",
            field=models.IntegerField(
                choices=[
                    (0, "Untriaged"),
                    (1, "Downstream"),
                    (2, "Reassigned"),
                    (3, "Invalid"),
                    (4, "Acknowledged"),
                    (5, "Infra"),
                ],
                default=0
            ),
        ),
        migrations.AlterField(
            model_name="performancealertsummary",
            name="status",
            field=models.IntegerField(
                choices=[
                    (0, "Untriaged"),
                    (1, "Downstream"),
                    (2, "Reassigned"),
                    (3, "Invalid"),
                    (4, "Improvement"),
                    (5, "Investigating"),
                    (6, "Won't fix"),
                    (7, "Fixed"),
                    (8, "Backed out"),
                    (10, "Infra"),
                ],
                default=0,
            ),
        ),
        migrations.AlterField(
            model_name="performancealertsummarytesting",
            name="status",
            field=models.IntegerField(
                choices=[
                    (0, "Untriaged"),
                    (1, "Downstream"),
                    (2, "Reassigned"),
                    (3, "Invalid"),
                    (4, "Improvement"),
                    (5, "Investigating"),
                    (6, "Won't fix"),
                    (7, "Fixed"),
                    (8, "Backed out"),
                    (10, "Infra"),
                ],
                default=0,
            ),
        ),
        migrations.AlterField(
            model_name="performancetelemetryalertsummary",
            name="status",
            field=models.IntegerField(
                choices=[
                    (0, "Untriaged"),
                    (1, "Downstream"),
                    (2, "Reassigned"),
                    (3, "Invalid"),
                    (4, "Improvement"),
                    (5, "Investigating"),
                    (6, "Won't fix"),
                    (7, "Fixed"),
                    (8, "Backed out"),
                    (10, "Infra"),
                ],
                default=0,
            ),
        ),
    ]
