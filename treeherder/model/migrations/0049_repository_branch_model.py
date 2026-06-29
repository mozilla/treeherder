import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('model', '0048_alter_failureline_action'),
    ]

    operations = [
        migrations.CreateModel(
            name='RepositoryBranch',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('branch', models.CharField(db_index=True, max_length=255)),
                ('repository', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='branches',
                    to='model.repository',
                )),
            ],
            options={
                'db_table': 'repository_branch',
            },
        ),
        migrations.AlterUniqueTogether(
            name='repositorybranch',
            unique_together={('repository', 'branch')},
        ),
        migrations.RemoveField(
            model_name='repository',
            name='branch',
        ),
    ]
