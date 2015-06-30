from django.db import models

from django_ci.models import ActivableModel, DataIngestionManager, Job


class JobLogUrl(ActivableModel):
    PARSE_STATUS_CHOICES = (
        (1, 'pending'),
        (2, 'parsed'),
        (3, 'failed'),
    )

    job = models.ForeignKey(Job)
    name = models.CharField(max_length=50, db_index=True)
    url = models.CharField(max_length=255, db_index=True)
    parse_status = models.CharField(max_length=7, blank=True, db_index=True,
                                    choices=PARSE_STATUS_CHOICES, default=1)
    parse_timestamp = models.IntegerField()

    objects = DataIngestionManager()
