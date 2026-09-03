import json
import logging
import time

from django.conf import settings
from django.contrib.auth.models import Group, User
from django.core.exceptions import ObjectDoesNotExist
from jose import jwt
from rest_framework.exceptions import AuthenticationFailed

from treeherder.config.settings import AUTH0_CLIENTID, AUTH0_DOMAIN

GROUPS_CLAIM = "https://sso.mozilla.com/claim/groups"

# SSO groups that grant sheriffing access.
SHERIFF_GROUPS = frozenset({"sheriff", "perf_sheriff"})

# SSO groups with commit access.
SCM_LEVEL_GROUPS = {
    "all_scm_level_1": 1,
    "all_scm_level_2": 2,
    "all_scm_level_3": 3,
}

TRACKED_SSO_GROUPS = frozenset(SCM_LEVEL_GROUPS) | SHERIFF_GROUPS

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
with open("treeherder/auth/jwks.json") as f:
    jwks = json.load(f)


def get_scm_level(user):
    """
    Highest hg commit level SSO has confirmed for `user`, or 0 if none is known.
    """
    if not user or not user.is_authenticated:
        return 0

    group_names = {group.name for group in user.groups.all()}

    return max(
        (level for name, level in SCM_LEVEL_GROUPS.items() if name in group_names), default=0
    )


class AuthBackend:
    def _get_access_token_expiry(self, request):
        expiration_timestamp_in_seconds = request.META.get("HTTP_ACCESS_TOKEN_EXPIRES_AT")

        if not expiration_timestamp_in_seconds:
            raise AuthenticationFailed("Access-Token-Expires-At header is expected")

        try:
            return int(expiration_timestamp_in_seconds)
        except ValueError:
            raise AuthenticationFailed("Access-Token-Expires-At header value is invalid")

    def _get_access_token(self, request):
        auth = request.META.get("HTTP_AUTHORIZATION")

        if not auth:
            raise AuthenticationFailed("Authorization header is expected")

        parts = auth.split()

        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise AuthenticationFailed("Authorization header must be of form 'Bearer {token}'")

        token = parts[1]
        return token

    def _get_id_token(self, request):
        id_token = request.META.get("HTTP_ID_TOKEN")

        if not id_token:
            raise AuthenticationFailed("Id-Token header is expected")

        return id_token

    def _get_id_token_expiry(self, user_info):
        # `exp` is the expiration of the ID token in seconds since the epoch:
        # https://auth0.com/docs/tokens/id-token#id-token-payload
        # https://openid.net/specs/openid-connect-core-1_0.html#IDToken
        return user_info["exp"]

    def _get_is_sheriff_from_userinfo(self, user_info):
        """
        Set users in sheriffing group in jwt response as is_staff
        """
        return 1 if SHERIFF_GROUPS.intersection(user_info.get(GROUPS_CLAIM, [])) else 0

    def _get_tracked_groups_from_userinfo(self, user_info):
        """
        The subset of the groups claim that Treeherder records, sorted so the
        stored membership is stable across logins.
        """
        groups = user_info.get(GROUPS_CLAIM) or []
        return sorted(group for group in groups if group in TRACKED_SSO_GROUPS)

    def _sync_sso_groups(self, user, tracked_groups):
        """
        Mirror `tracked_groups` into Django group membership.

        The groups claim only reaches us on /auth/login/; every other request is
        session-authenticated and carries no token, so membership has to be
        persisted here to be checkable later (see `get_scm_level`).
        """
        stale = user.groups.filter(name__in=TRACKED_SSO_GROUPS).exclude(name__in=tracked_groups)
        user.groups.remove(*stale)
        user.groups.add(*[Group.objects.get_or_create(name=name)[0] for name in tracked_groups])

    def _get_username_from_userinfo(self, user_info):
        """
        Get the user's username from the jwt sub property
        """

        subject = user_info["sub"]
        email = user_info["email"]

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
            raise AuthError("Unable to decode the Id token header")

        if "kid" not in unverified_header:
            raise AuthError("Id token header missing RSA key ID")

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
            raise AuthError("Id token using unrecognised RSA key ID")

        try:
            # https://python-jose.readthedocs.io/en/latest/jwt/api.html#jose.jwt.decode
            user_info = jwt.decode(
                id_token,
                rsa_key,
                algorithms=["RS256"],
                audience=AUTH0_CLIENTID,
                access_token=access_token,
                issuer="https://" + AUTH0_DOMAIN + "/",
            )
            return user_info
        except jwt.ExpiredSignatureError:
            raise AuthError("Id token is expired")
        except jwt.JWTClaimsError:
            raise AuthError("Incorrect claims: please check the audience and issuer")
        except jwt.JWTError:
            raise AuthError("Invalid header: Unable to parse authentication")

    def _calculate_session_expiry(self, request, user_info):
        """Returns the number of seconds after which the Django session should expire."""
        access_token_expiry_timestamp = self._get_access_token_expiry(request)
        id_token_expiry_timestamp = self._get_id_token_expiry(user_info)
        now_in_seconds = int(time.time())

        # Log token expiration details
        logger.debug(
            "Token expiration details - Access token: %s (%s), ID token: %s (%s), Current time: %s",
            access_token_expiry_timestamp,
            time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(access_token_expiry_timestamp)),
            id_token_expiry_timestamp,
            time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(id_token_expiry_timestamp)),
            time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(now_in_seconds)),
        )

        # The session length is set to match whichever token expiration time is closer.
        earliest_expiration_timestamp = min(
            access_token_expiry_timestamp, id_token_expiry_timestamp
        )
        seconds_until_expiry = earliest_expiration_timestamp - now_in_seconds

        if seconds_until_expiry <= 0:
            logger.error(
                "Session expiry time has already passed! Current time exceeds token expiration."
            )
            raise AuthError("Session expiry time has already passed!")

        # Cap the session so it can't outlive the frontend's renewal heartbeat.
        # The renewal re-extends the session every RENEW_INTERVAL, so this never
        # shortens an actively-renewing user's session; it only ensures that once
        # renewals stop (e.g. SSO access revoked) the session lapses promptly
        # instead of coasting on the token's much longer lifetime.
        # See AUTH_MAX_SESSION_AGE_SECONDS in settings.py.
        return min(seconds_until_expiry, settings.AUTH_MAX_SESSION_AGE_SECONDS)

    def authenticate(self, request):
        logger.debug("Authentication attempt started")
        try:
            access_token = self._get_access_token(request)
            id_token = self._get_id_token(request)
            logger.debug("Authentication tokens retrieved successfully")

            user_info = self._get_user_info(access_token, id_token)
            username = self._get_username_from_userinfo(user_info)
            is_sheriff = self._get_is_sheriff_from_userinfo(user_info)
            tracked_groups = self._get_tracked_groups_from_userinfo(user_info)
            groups_claim_present = GROUPS_CLAIM in user_info
            logger.debug("User info retrieved for: %s", username)

            seconds_until_expiry = self._calculate_session_expiry(request, user_info)
            logger.debug(
                "Updating session to expire in %i seconds for user %s",
                seconds_until_expiry,
                username,
            )

            # Convert seconds to more readable format
            hours = seconds_until_expiry // 3600
            minutes = (seconds_until_expiry % 3600) // 60
            logger.debug("Session will expire in %d hours and %d minutes", hours, minutes)

            request.session.set_expiry(seconds_until_expiry)

            try:
                user = User.objects.get(username=username)
                logger.debug("Existing user authenticated: %s", username)
                if groups_claim_present:
                    # An empty groups claim demotes just like a claim that lacks
                    # the sheriff groups. This is expected on a genuine login by a
                    # user who has lost their groups, but if it shows up on silent
                    # renewals it would mean the "absent claim" assumption below is
                    # wrong -- log it so that case is visible.
                    if not user_info.get(GROUPS_CLAIM) and user.is_staff:
                        logger.warning(
                            "Groups claim present but empty for %s; demoting is_staff. "
                            "If this recurs on token renewals, the absent-claim "
                            "assumption in this backend needs revisiting.",
                            username,
                        )
                    if user.is_staff != is_sheriff:
                        user.is_staff = is_sheriff
                        user.save()
                        logger.debug("Updated staff status for user %s to %s", username, is_sheriff)
                    self._sync_sso_groups(user, tracked_groups)
                elif user.is_staff:
                    # No groups claim on this token. This is typical of a silent
                    # token renewal, where Auth0 omits the large custom claim.
                    # Preserve the user's existing is_staff rather than demoting
                    # them; logged at info so we can confirm how often it fires.
                    logger.info(
                        "Preserving is_staff=True for %s: groups claim absent from token "
                        "(expected on silent renewals)",
                        username,
                    )
                return user
            except ObjectDoesNotExist:
                # The user doesn't already exist, so create it since we allow
                # anyone with SSO access to create an account on Treeherder.
                logger.debug("Creating new user: %s", username)
                user = User.objects.create_user(
                    username, email=user_info["email"], password=None, is_staff=is_sheriff
                )
                if groups_claim_present:
                    self._sync_sso_groups(user, tracked_groups)
                return user
        except AuthenticationFailed as e:
            logger.error("Authentication failed: %s", str(e))
            raise
        except AuthError as e:
            logger.error("Auth error during authentication: %s", str(e))
            raise
        except Exception as e:
            logger.error("Unexpected error during authentication: %s", str(e))
            raise

    def get_user(self, user_id):
        try:
            return User._default_manager.get(pk=user_id)
        except User.DoesNotExist:
            return None


class AuthError(Exception):
    pass
