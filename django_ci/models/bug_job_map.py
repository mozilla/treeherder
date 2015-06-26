from django.db import models
from django.contrib.auth.models import User

from django_ci.models import ActivableModel, Job


class BugJobMap(ActivableModel):
    job = models.ForeignKey(Job)
    bug_id = models.IntegerField(db_index=True)
    submit_timestamp = models.IntegerField(db_index=True)
    who = models.ForeignKey(User)

    class Meta:
        unique_together = (('job', 'bug_id'),)
