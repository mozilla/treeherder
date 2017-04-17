from django.db import models


class JobEta(models.Model):
    signature = models.CharField(max_length=50, db_index=True)
    state = models.CharField(max_length=25, db_index=True)
    avg_sec = models.IntegerField()
    median_sec = models.IntegerField()
    min_sec = models.IntegerField()
    max_sec = models.IntegerField()
    std = models.IntegerField()
    sample_count = models.IntegerField()
    submit_timestamp = models.IntegerField()
