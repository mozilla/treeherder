from django.contrib.auth.models import User

class TaskclusterAuthBackend(object):
    def authenticate(self, client_id=None, access_token=None, credentials=None):
        return User.objects.get(username="camd")