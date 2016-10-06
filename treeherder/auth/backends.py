import logging
from hashlib import sha1

from django.contrib.auth.models import User
from django.db.models import Q
from taskcluster.sync import Auth

logger = logging.getLogger(__name__)


class TaskclusterAuthBackend(object):

    def authenticate(self, authorization=None, host=None, port=None):
        user = None

        if authorization:
            tc_auth = Auth()
            result = tc_auth.authenticateHawk({
                "authorization": authorization,
                "host": host,
                "port": port,
                "resource": "/",
                "method": "get",
            })

            if result["status"] == "auth-success":
                username = result["clientId"][-30:]
                email = result["clientId"].split("/")[1]

                user = User.objects.filter(
                    Q(email=email) | Q(username=username)).first()

                if not user:
                    # the user doesn't already exist, create it.
                    logger.warning("Creating new user: {}".format(email))
                    sha = sha1()
                    sha.update(email)
                    user = User(email=email,
                                username=username,
                                password=sha.hexdigest()[25:]
                                )
                    user.save()

        return user

    def get_user(self, user_id):
        try:
            return User._default_manager.get(pk=user_id)
        except User.DoesNotExist:
            return None
