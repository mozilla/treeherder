# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models, transaction


def combine_classified_failures(apps, schema_editor):
    ClassifiedFailure = apps.get_model("model", "ClassifiedFailure")
    FailureMatch = apps.get_model("model", "FailureMatch")
    FailureLine = apps.get_model("model", "FailureLine")
    duplicates = ClassifiedFailure.objects.raw(
        """SELECT *, count(*) as c FROM classified_failure
WHERE classified_failure.bug_number IS NOT NULL
GROUP BY classified_failure.bug_number
HAVING c > 1""")
    with transaction.atomic():
        for item in duplicates:
            bug_number = item.bug_number
            query = ClassifiedFailure.objects.filter(bug_number=bug_number).order_by('id')
            retain = query[0]
            remove_ids = [item.id for item in query[1:]]
            failure_matches = FailureMatch.objects.filter(classified_failure__in=remove_ids)
            for match in failure_matches:
                try:
                    existing = FailureMatch.objects.get(classified_failure=retain,
                                                        failure_line=match.failure_line)
                    existing.score = max(existing.score, match.score)
                    match.delete()
                except FailureMatch.DoesNotExist:
                    match.classified_failure = retain
                    match.save()
            FailureLine.objects.filter(best_classification__in=remove_ids).update(best_classification=retain)
            ClassifiedFailure.objects.filter(id__in=remove_ids).delete()


def noop(*args):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0017_add_centralized_job_model'),
    ]

    operations = [
        migrations.RunPython(combine_classified_failures, noop)
    ]
