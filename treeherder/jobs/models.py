from django.db import models


class JobDetail(models.Model):
    '''
    Represents metadata associated with a job
    '''
    id = models.AutoField(primary_key=True)
    job_guid = models.CharField(max_length=50, db_index=True)
    title = models.CharField(max_length=200, null=True)
    value = models.CharField(max_length=200)
    url = models.URLField(null=True)

    class Meta:
        db_table = "job_detail"

    def __str__(self):
        return "{0} {1} {2} {3} {4}".format(self.id,
                                            self.job_guid,
                                            self.title,
                                            self.value,
                                            self.url)
