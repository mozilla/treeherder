# Generated migration for adding trust_domain and project fields to Repository

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('model', '0048_alter_failureline_action'),
    ]

    operations = [
        migrations.AddField(
            model_name='repository',
            name='trust_domain',
            field=models.CharField(
                blank=True,
                db_index=True,
                max_length=100,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='repository',
            name='project',
            field=models.CharField(
                blank=True,
                db_index=True,
                max_length=100,
                null=True,
            ),
        ),
        migrations.AddIndex(
            model_name='repository',
            index=models.Index(
                fields=['trust_domain', 'project', 'branch'],
                name='repo_v2_route_idx',
            ),
        ),
    ]
