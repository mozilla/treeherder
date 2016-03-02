import newrelic.agent

from rest_framework import exceptions

from treeherder.credentials.models import Credentials


def hawk_lookup(id):
    try:
        newrelic.agent.add_custom_parameter("hawk_user", id)
        credentials = Credentials.objects.get(client_id=id, authorized=True)
    except Credentials.DoesNotExist:
        raise exceptions.AuthenticationFailed(
            'No authentication credentials found with id %s' % id)

    return {
        'id': id,
        'key': str(credentials.secret),
        'algorithm': 'sha256'
    }
