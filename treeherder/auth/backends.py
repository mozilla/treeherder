import json
import logging
import time

from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from jose import jwt
from rest_framework.exceptions import AuthenticationFailed

from treeherder.config.settings import (AUTH0_CLIENTID,
                                        AUTH0_DOMAIN)

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


class AuthBackend(object):

    def _get_accesstoken_expiry(self, request):
        expires_at_in_milliseconds = request.META.get("HTTP_EXPIRESAT")

        if not expires_at_in_milliseconds:
            raise AuthenticationFailed("expiresAt header is expected")

        return int(expires_at_in_milliseconds)

    def _get_token_auth_header(self, request):
        auth = request.META.get("HTTP_AUTHORIZATION")

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
        else:
            raise AuthenticationFailed("Unrecognized identity")

    def _get_user_info(self, request):
        access_token = self._get_token_auth_header(request)
        id_token = request.META.get("HTTP_IDTOKEN")

        # JWT Validator
        # Per https://auth0.com/docs/quickstart/backend/python/01-authorization#create-the-jwt-validation-decorator

        unverified_header = jwt.get_unverified_header(id_token)

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
            user_info = jwt.decode(
                id_token,
                rsa_key,
                algorithms=['RS256'],
                audience=AUTH0_CLIENTID,
                access_token=access_token,
                issuer="https://"+AUTH0_DOMAIN+"/"
            )

            return user_info
        except jwt.ExpiredSignatureError:
            raise AuthError("Token is expired")
        except jwt.JWTClaimsError:
            raise AuthError("Incorrect claims: please check the audience and issuer")
        except Exception:
            raise AuthError("Invalid header: Unable to parse authentication")

    def authenticate(self, request):
        user_info = self._get_user_info(request)
        username = self._get_username_from_userinfo(user_info)

        # Look for an existing user by username/clientId
        # If not found, create it, as long as it has an email.
        try:
            user = User.objects.get(username=username)

            accesstoken_exp_in_ms = self._get_accesstoken_expiry(request)
            # Per http://openid.net/specs/openid-connect-core-1_0.html#IDToken, exp is given in seconds
            idtoken_exp_in_ms = user_info['exp'] * 1000
            now_in_ms = int(round(time.time() * 1000))

            # The Django user session expiration should be set to the token for which the expiry is closer.
            session_expiry_in_ms = min(accesstoken_exp_in_ms, idtoken_exp_in_ms)
            expires_in = (session_expiry_in_ms - now_in_ms) / 1000

            logger.debug("Updating session to expire in %d hours" % (expires_in / 3600))

            request.session.set_expiry(expires_in)

            return user

        except ObjectDoesNotExist:
            # the user doesn't already exist, create it.
            logger.warning("Creating new user: {}".format(username))
            return User.objects.create_user(username, email=user_info['email'])

    def get_user(self, user_id):
        try:
            return User._default_manager.get(pk=user_id)
        except User.DoesNotExist:
            return None


class NoEmailException(Exception):
    pass


class AuthError(Exception):
    pass
