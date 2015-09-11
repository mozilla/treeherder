import oauth2 as oauth
from django.conf import settings
from rest_framework import exceptions
from rest_framework.authentication import BaseAuthentication
from rest_framework.renderers import JSONRenderer

from treeherder.credentials.models import Credentials
from treeherder.etl.oauth_utils import OAuthCredentials


class DummyUser(object):
    pass


class TwoLeggedOauthAuthentication(BaseAuthentication):

    def auth_detected(self, request):
        oauth_parameters = (
            'oauth_body_hash',
            'oauth_nonce',
            'oauth_timestamp',
            'oauth_consumer_key',
            'oauth_signature_method',
            'oauth_version',
            'oauth_token',
            'user',
            'oauth_signature',
        )
        return all(param in request.query_params for param in oauth_parameters)

    def authenticate(self, request):

        if not self.auth_detected(request):
            return None

        user = request.resolver_match.kwargs.get('project') or request.query_params['user']
        project_credentials = OAuthCredentials.get_credentials(user)

        if not project_credentials:
            raise exceptions.ValidationError(
                'project {0} has no OAuth credentials'.format(user)
            )
        parameters = OAuthCredentials.get_parameters(request.query_params)

        oauth_consumer_key = parameters['oauth_consumer_key']

        if oauth_consumer_key != project_credentials['consumer_key']:
            raise exceptions.AuthenticationFailed(
                'oauth_consumer_key does not match credentials for project {0}'.format(user)
            )

        uri = '{0}://{1}{2}'.format(
            settings.TREEHERDER_REQUEST_PROTOCOL,
            request.get_host(),
            request.path
        )
        # Construct the OAuth request based on the django request object
        json_renderer = JSONRenderer()
        req_obj = oauth.Request(
            method=request.method,
            url=uri,
            parameters=parameters,
            body=json_renderer.render(request.DATA),
        )
        server = oauth.Server()
        token = oauth.Token(key='', secret='')
        # Get the consumer object
        cons_obj = oauth.Consumer(
            oauth_consumer_key,
            project_credentials['consumer_secret']
        )
        # Set the signature method
        server.add_signature_method(oauth.SignatureMethod_HMAC_SHA1())

        try:
            # verify oauth django request and consumer object match
            server.verify_request(req_obj, cons_obj, token)
        except oauth.Error:
            raise exceptions.AuthenticationFailed(
                'Client authentication failed for project {0}'.format(user)
            )
        request.legacy_oauth_authenticated = True
        return (DummyUser(), None)


def hawk_lookup(id):
    try:
        credentials = Credentials.objects.get(client_id=id, authorized=True)
    except Credentials.DoesNotExist:
        raise exceptions.AuthenticationFailed(
            'No authentication credentials found with id %s' % id)

    return {
        'id': id,
        'key': str(credentials.secret),
        'algorithm': 'sha256'
    }
