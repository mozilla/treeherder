import uuid

from django.contrib.auth.models import User
from django.db import models


class Credentials(models.Model):
    """A list of treeherder api credentials"""
    client_id = models.SlugField("client ID", max_length=32, unique=True)
    secret = models.UUIDField(default=uuid.uuid4, editable=False)
    description = models.TextField()
    owner = models.ForeignKey(User, null=True)
    authorized = models.BooleanField(default=False)
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'credentials'
        verbose_name_plural = 'credentials'
