from django.db import models


class ActivableModel(models.Model):
    ACTIVE_STATUS_CHOICES = (
        (1, 'active'),
        (2, 'onhold'),
        (3, 'deleted'),
    )
    active_status = models.PositiveSmallIntegerField(default=1, db_index=True)

    class Meta:
        abstract = True
