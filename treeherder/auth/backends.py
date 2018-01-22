import json
import logging
import time

from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.exceptions import ObjectDoesNotExist
from jose import jwt
from rest_framework.exceptions import AuthenticationFailed

from six.moves.urllib.request import (Request,
                                      urlopen)
from treeherder.config.settings import (AUTH0_AUDIENCE,
                                        AUTH0_DOMAIN)

logger = logging.getLogger(__name__)


class AuthBackend(object):

    def _get_session_expiry(self, request):
        expires_at_in_milliseconds = request.META.get("HTTP_EXPIRESAT")

        if not expires_at_in_milliseconds:
            raise AuthenticationFailed("expiresAt header is expected")

        return int(expires_at_in_milliseconds)

    def _get_token_auth_header(self, request):
        auth = request.META.get("HTTP_AUTHORIZATION", None)

        if not auth:
            raise AuthenticationFailed("Authorization header is expected")

        parts = auth.split()

        if parts[0].lower() != "bearer":
            raise AuthenticationFailed("Authorization header must start with 'Bearer'")

        elif len(parts) == 1:
            raise AuthenticationFailed("Token not found")

        elif len(parts) > 2:
            raise AuthenticationFailed("Authorization header must be 'Bearer {token}'")

        token = parts[1]

        return token

    def _get_clientid_from_userinfo(self, user_info):
        """
        Get the user's client_id from the jwt sub property
        """

        subject = user_info['sub']
        email = user_info['email']

        if "Mozilla-LDAP" in subject:
            return "mozilla-ldap/" + email
        elif "email" in subject:
            return "email/" + email
        else:
            raise AuthenticationFailed("Unrecognized identity")

    def _get_jwks_json(self):
        """
        Get the JSON Web Key Set (jwks), which is a set of keys
        containing the public keys that should be used to verify
        any JWT issued by the authorization server. Auth0 exposes
        a JWKS endpoint for each tenant, which is found at
        'https://' + AUTH0_DOMAIN + '/.well-known/jwks.json'. This endpoint
        will contain the JWK used to sign all Auth0 issued JWTs for this tenant.
        Reference: https://auth0.com/docs/jwks
        """

        cache_key = 'well-known-jwks'
        cached_jwks = cache.get(cache_key)

        if cached_jwks is not None:
            return cached_jwks

        cached_jwks = urlopen('https://' + AUTH0_DOMAIN + '/.well-known/jwks.json').read()
        cache.set(cache_key, cached_jwks)

        return cached_jwks

    def _validate_token(self, request):
        token = self._get_token_auth_header(request)
        # JWT Validator
        # Per https://auth0.com/docs/quickstart/backend/python/01-authorization#create-the-jwt-validation-decorator
        jwks_json = self._get_jwks_json()
        jwks = json.loads(jwks_json)

        unverified_header = jwt.get_unverified_header(token)

        rsa_key = {}
        for key in jwks["keys"]:
            if key["kid"] == unverified_header["kid"]:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"]
                }

        if not rsa_key:
            raise AuthError({"code": "rsa_key",
                            "description": "rsa_key is empty"}, 401)

        try:
            jwt.decode(
                token,
                rsa_key,
                algorithms=['RS256'],
                audience=AUTH0_AUDIENCE,
                issuer="https://"+AUTH0_DOMAIN+"/"
            )
        except jwt.ExpiredSignatureError:
            raise AuthError({"code": "token_expired",
                            "description": "token is expired"}, 401)
        except jwt.JWTClaimsError:
            raise AuthError({"code": "invalid_claims",
                            "description":
                                "incorrect claims,"
                                "please check the audience and issuer"}, 401)
        except Exception:
            raise AuthError({"code": "invalid_header",
                            "description":
                                "Unable to parse authentication"
                                " token."}, 400)

    def _get_user_info(self, request):
        user_info_url = 'https://' + AUTH0_DOMAIN + '/userinfo'

        return json.loads(
            urlopen(Request(user_info_url, headers={'Authorization': request.META.get('HTTP_AUTHORIZATION', None)})).read())

    def authenticate(self, request):
        self._validate_token(request)
        user_info = self._get_user_info(request)
        client_id = self._get_clientid_from_userinfo(user_info)

        # Look for an existing user by username/clientId
        # If not found, create it, as long as it has an email.
        try:
            return User.objects.get(username=client_id)

        except ObjectDoesNotExist:
            # the user doesn't already exist, create it.
            logger.warning("Creating new user: {}".format(client_id))
            return User.objects.create_user(client_id, email=user_info['email'])

        expires_at_in_milliseconds = self._get_session_expiry(request)
        now_in_milliseconds = int(round(time.time() * 1000))
        # The Django user session expiration should be set to match the expiry time of the Auth0 token
        request.session.set_expiry((expires_at_in_milliseconds - now_in_milliseconds) / 1000)

    def get_user(self, user_id):
        try:
            return User._default_manager.get(pk=user_id)
        except User.DoesNotExist:
            return None


class NoEmailException(Exception):
    pass


class AuthError(Exception):
    pass
