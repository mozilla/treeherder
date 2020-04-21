import json
import logging
import time

from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from jose import jwt
from rest_framework.exceptions import AuthenticationFailed

from treeherder.config.settings import AUTH0_CLIENTID, AUTH0_DOMAIN

logger = logging.getLogger(__name__)

# The JSON Web Key Set (jwks), which is a set of keys
# containing the public keys that should be used to verify
# any JWT issued by the authorization server. Auth0 exposes
# a JWKS endpoint for each tenant, which is found at
# 'https://' + AUTH0_DOMAIN + '/.well-known/jwks.json'. This endpoint
# will contain the JWK used to sign all Auth0 issued JWTs for this tenant.
# Reference: https://auth0.com/docs/jwks

# The jwks is under our (Mozilla's) control. Changing it would be a big thing
# with lots of notice in advance. In order to mitigate the additional HTTP request
# as well as the possiblity of receiving a 503 status code, we use a static json file to
# read its content.
with open('treeherder/auth/jwks.json') as f:
    jwks = json.load(f)


class AuthBackend:
    def _get_access_token_expiry(self, request):
        expiration_timestamp_in_seconds = request.META.get('HTTP_ACCESS_TOKEN_EXPIRES_AT')

        if not expiration_timestamp_in_seconds:
            raise AuthenticationFailed('Access-Token-Expires-At header is expected')

        try:
            return int(expiration_timestamp_in_seconds)
        except ValueError:
            raise AuthenticationFailed('Access-Token-Expires-At header value is invalid')

    def _get_access_token(self, request):
        auth = request.META.get('HTTP_AUTHORIZATION')

        if not auth:
            raise AuthenticationFailed('Authorization header is expected')

        parts = auth.split()

        if len(parts) != 2 or parts[0].lower() != 'bearer':
            raise AuthenticationFailed("Authorization header must be of form 'Bearer {token}'")

        token = parts[1]
        return token

    def _get_id_token(self, request):
        id_token = request.META.get('HTTP_ID_TOKEN')

        if not id_token:
            raise AuthenticationFailed('Id-Token header is expected')

        return id_token

    def _get_id_token_expiry(self, user_info):
        # `exp` is the expiration of the ID token in seconds since the epoch:
        # https://auth0.com/docs/tokens/id-token#id-token-payload
        # https://openid.net/specs/openid-connect-core-1_0.html#IDToken
        return user_info['exp']

    def _get_username_from_userinfo(self, user_info):
        """
        Get the user's username from the jwt sub property
        """

        subject = user_info['sub']
        email = user_info['email']

        if "Mozilla-LDAP" in subject:
            return "mozilla-ldap/" + email
        elif "email" in subject:
            return "email/" + email
        elif "github" in subject:
            return "github/" + email
        elif "google" in subject:
            return "google/" + email
        # Firefox account
        elif "oauth2" in subject:
            return "oauth2/" + email
        else:
            raise AuthenticationFailed("Unrecognized identity")

    def _get_user_info(self, access_token, id_token):
        """
        Extracts the user info payload from the Id Token.

        Example return value:

        {
            "at_hash": "<HASH>",
            "aud": "<HASH>",
            "email_verified": true,
            "email": "fsurname@mozilla.com",
            "exp": 1551259495,
            "family_name": "Surname",
            "given_name": "Firstname",
            "https://sso.mozilla.com/claim/groups": [
                "all_scm_level_1",
                "all_scm_level_2",
                "all_scm_level_3",
                # ...
            ],
            "iat": 1550654695,
            "iss": "https://auth.mozilla.auth0.com/",
            "name": "Firstname Surname",
            "nickname": "Firstname Surname",
            "nonce": "<HASH>",
            "picture": "<GRAVATAR_URL>",
            "sub": "ad|Mozilla-LDAP|fsurname",
            "updated_at": "2019-02-20T09:24:55.449Z",
        }
        """

        # JWT Validator
        # Per https://auth0.com/docs/quickstart/backend/python/01-authorization#create-the-jwt-validation-decorator

        try:
            unverified_header = jwt.get_unverified_header(id_token)
        except jwt.JWTError:
            raise AuthError('Unable to decode the Id token header')

        if 'kid' not in unverified_header:
            raise AuthError('Id token header missing RSA key ID')

        rsa_key = None
        for key in jwks["keys"]:
            if key["kid"] == unverified_header["kid"]:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"],
                }
                break

        if not rsa_key:
            raise AuthError('Id token using unrecognised RSA key ID')

        try:
            # https://python-jose.readthedocs.io/en/latest/jwt/api.html#jose.jwt.decode
            user_info = jwt.decode(
                id_token,
                rsa_key,
                algorithms=['RS256'],
                audience=AUTH0_CLIENTID,
                access_token=access_token,
                issuer="https://" + AUTH0_DOMAIN + "/",
            )
            return user_info
        except jwt.ExpiredSignatureError:
            raise AuthError('Id token is expired')
        except jwt.JWTClaimsError:
            raise AuthError("Incorrect claims: please check the audience and issuer")
        except jwt.JWTError:
            raise AuthError("Invalid header: Unable to parse authentication")

    def _calculate_session_expiry(self, request, user_info):
        """Returns the number of seconds after which the Django session should expire."""
        access_token_expiry_timestamp = self._get_access_token_expiry(request)
        id_token_expiry_timestamp = self._get_id_token_expiry(user_info)
        now_in_seconds = int(time.time())

        # The session length is set to match whichever token expiration time is closer.
        earliest_expiration_timestamp = min(
            access_token_expiry_timestamp, id_token_expiry_timestamp
        )
        seconds_until_expiry = earliest_expiration_timestamp - now_in_seconds

        if seconds_until_expiry <= 0:
            raise AuthError('Session expiry time has already passed!')

        return seconds_until_expiry

    def authenticate(self, request):
        access_token = self._get_access_token(request)
        id_token = self._get_id_token(request)

        user_info = self._get_user_info(access_token, id_token)
        username = self._get_username_from_userinfo(user_info)

        seconds_until_expiry = self._calculate_session_expiry(request, user_info)
        logger.debug('Updating session to expire in %i seconds', seconds_until_expiry)
        request.session.set_expiry(seconds_until_expiry)

        try:
            return User.objects.get(username=username)
        except ObjectDoesNotExist:
            # The user doesn't already exist, so create it since we allow
            # anyone with SSO access to create an account on Treeherder.
            logger.debug('Creating new user: %s', username)
            return User.objects.create_user(username, email=user_info['email'])

    def get_user(self, user_id):
        try:
            return User._default_manager.get(pk=user_id)
        except User.DoesNotExist:
            return None


class AuthError(Exception):
    pass
