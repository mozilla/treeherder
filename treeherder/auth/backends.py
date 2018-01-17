import json
import logging
import re
import time

from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from jose import jwt
from rest_framework.exceptions import AuthenticationFailed

from six.moves.urllib.request import urlopen
from treeherder.config.settings import (AUTH0_AUDIENCE,
                                        AUTH0_DOMAIN)

logger = logging.getLogger(__name__)

CLIENT_ID_RE = re.compile(
    r"^(?:email|mozilla-ldap)/([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.["
    r"a-zA-Z0-9-.]+)$")


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

    def _extract_email_from_clientid(self, client_id):
        """
        Extract the user's email from the client_id
        """

        # Client IDs must be in one of these forms:
        # - email/foo@bar.com
        # - mozilla-ldap/foo@bar.com
        # Email regex taken from http://emailregex.com
        match = CLIENT_ID_RE.match(client_id)
        if match:
            return match.group(1)

        raise NoEmailException(
            "No email found in clientId: '{}'".format(client_id))

    def authenticate(self, request):
        token = self._get_token_auth_header(request)
        expires_at_in_milliseconds = self._get_session_expiry(request)
        now_in_milliseconds = int(round(time.time() * 1000))

        # The Django user session expiration should be set to match the expiry time of the Auth0 token
        request.session.set_expiry((expires_at_in_milliseconds - now_in_milliseconds) / 1000)

        # JWT Validator
        # Per https://auth0.com/docs/quickstart/backend/python/01-authorization#create-the-jwt-validation-decorator
        jsonurl = urlopen('https://' + AUTH0_DOMAIN + '/.well-known/jwks.json')
        jwks = json.loads(jsonurl.read())
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

        if rsa_key:
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

        client_id = request.META.get("HTTP_CLIENTID", None)
        email = self._extract_email_from_clientid(client_id)

        # Look for an existing user by username/clientId
        # If not found, create it, as long as it has an email.
        try:
            return User.objects.get(username=client_id)

        except ObjectDoesNotExist:
            # the user doesn't already exist, create it.
            logger.warning("Creating new user: {}".format(client_id))
            return User.objects.create_user(client_id, email=email)

    def get_user(self, user_id):
        try:
            return User._default_manager.get(pk=user_id)
        except User.DoesNotExist:
            return None


class NoEmailException(Exception):
    pass


class AuthError(Exception):
    pass
