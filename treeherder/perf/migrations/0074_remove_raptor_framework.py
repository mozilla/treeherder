from django.db import migrations


def remove_raptor_framework(apps, schema_editor):
    PerformanceFramework = apps.get_model('perf', 'PerformanceFramework')

    # avoid crashing if already deleted
    raptor_fw = PerformanceFramework.objects.filter(name='raptor')
    if raptor_fw:
        raptor_fw.delete()

class Migration(migrations.Migration):

    dependencies = [
        ('perf', '0073_add_alert_severity_to_performance_signature'),
    ]

    operations = [
        migrations.RunPython(remove_raptor_framework, reverse_code=migrations.RunPython.noop),
    ]
