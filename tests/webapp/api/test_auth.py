import time

import pytest
from django.conf import settings
from django.contrib.auth import SESSION_KEY
from django.contrib.auth.models import AnonymousUser, Group
from django.urls import reverse
from rest_framework import status
from rest_framework.decorators import APIView
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory

from treeherder.auth.backends import AuthBackend, get_scm_level
from treeherder.model.models import User

GROUPS_CLAIM = "https://sso.mozilla.com/claim/groups"

one_hour_in_seconds = 60 * 60
one_day_in_seconds = 24 * one_hour_in_seconds


class AuthenticatedView(APIView):
    """This inherits `IsAuthenticatedOrReadOnly` due to `DEFAULT_PERMISSION_CLASSES`."""

    def get(self, request, *args, **kwargs):
        return Response({"foo": "bar"})

    def post(self, request, *args, **kwargs):
        return Response({"foo": "bar"})


factory = APIRequestFactory()
url = "http://testserver/"


def test_get_no_auth():
    request = factory.get(url)
    view = AuthenticatedView.as_view()
    response = view(request)
    assert response.status_code == status.HTTP_200_OK
    assert response.data == {"foo": "bar"}


def test_post_no_auth():
    request = factory.post(url)
    view = AuthenticatedView.as_view()
    response = view(request)
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.data == {"detail": "Authentication credentials were not provided."}


# Auth Login and Logout Tests


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("id_token_sub", "id_token_email", "expected_username"),
    [
        ("ad|Mozilla-LDAP|biped", "biped@mozilla.com", "mozilla-ldap/biped@mozilla.com"),
        ("email", "biped@mozilla.com", "email/biped@mozilla.com"),
        ("oauth2|biped", "biped@mozilla.com", "oauth2/biped@mozilla.com"),
        ("github|0000", "biped@gmail.com", "github/biped@gmail.com"),
        ("google-oauth2|0000", "biped@mozilla.com", "google/biped@mozilla.com"),
    ],
)
def test_login_logout_relogin(client, monkeypatch, id_token_sub, id_token_email, expected_username):
    """
    Test that a new user is able to log in via a variety of identity providers,
    and that their created Django user is correctly found again on next login.
    """
    now_in_seconds = int(time.time())
    id_token_expiration_timestamp = now_in_seconds + one_day_in_seconds
    access_token_expiration_timestamp = now_in_seconds + one_hour_in_seconds

    def userinfo_mock(*args, **kwargs):
        return {"sub": id_token_sub, "email": id_token_email, "exp": id_token_expiration_timestamp}

    monkeypatch.setattr(AuthBackend, "_get_user_info", userinfo_mock)

    assert SESSION_KEY not in client.session
    assert User.objects.count() == 0

    # The first time someone logs in a new user should be created,
    # which is then associated with their Django session.

    resp = client.get(
        reverse("auth-login"),
        HTTP_AUTHORIZATION="Bearer meh",
        HTTP_ID_TOKEN="meh",
        HTTP_ACCESS_TOKEN_EXPIRES_AT=str(access_token_expiration_timestamp),
    )
    assert resp.status_code == 200
    assert resp.json() == {
        "username": expected_username,
        "email": id_token_email,
        "is_staff": False,
        "is_superuser": False,
    }
    assert SESSION_KEY in client.session
    # Uses a tolerance of up to 5 seconds to account for rounding/the time the test takes to run.
    assert client.session.get_expiry_age() == pytest.approx(
        min(one_hour_in_seconds, settings.AUTH_MAX_SESSION_AGE_SECONDS), abs=5
    )

    assert User.objects.count() == 1
    session_user_id = int(client.session[SESSION_KEY])
    user = User.objects.get(id=session_user_id)
    assert user.username == expected_username
    assert user.email == id_token_email

    # Logging out should disassociate the user from the Django session.

    resp = client.get(reverse("auth-logout"))
    assert resp.status_code == 200
    assert SESSION_KEY not in client.session

    # Logging in again should associate the existing user with the Django session.

    resp = client.get(
        reverse("auth-login"),
        HTTP_AUTHORIZATION="Bearer meh",
        HTTP_ID_TOKEN="meh",
        HTTP_ACCESS_TOKEN_EXPIRES_AT=str(access_token_expiration_timestamp),
    )
    assert resp.status_code == 200
    assert resp.json()["username"] == expected_username
    assert SESSION_KEY in client.session
    assert client.session.get_expiry_age() == pytest.approx(
        min(one_hour_in_seconds, settings.AUTH_MAX_SESSION_AGE_SECONDS), abs=5
    )
    assert User.objects.count() == 1


def test_login_same_email_different_provider(test_ldap_user, client, monkeypatch):
    """
    Test that an existing user is not re-used if the email address matches,
    but the provider is different. This is important since some providers are
    more secure than others, and therefore may be given greater permissions.
    """
    now_in_seconds = int(time.time())
    id_token_expiration_timestamp = now_in_seconds + one_day_in_seconds
    access_token_expiration_timestamp = now_in_seconds + one_hour_in_seconds

    def userinfo_mock(*args, **kwargs):
        return {"sub": "email", "email": test_ldap_user.email, "exp": id_token_expiration_timestamp}

    monkeypatch.setattr(AuthBackend, "_get_user_info", userinfo_mock)

    resp = client.get(
        reverse("auth-login"),
        HTTP_AUTHORIZATION="Bearer meh",
        HTTP_ID_TOKEN="meh",
        HTTP_ACCESS_TOKEN_EXPIRES_AT=str(access_token_expiration_timestamp),
    )
    assert resp.status_code == 200
    assert resp.json()["username"] == "email/user@foo.com"
    assert resp.json()["email"] == test_ldap_user.email


def test_login_unknown_identity_provider(client, monkeypatch):
    """Test an id token `sub` value that does not match a known identity provider."""
    now_in_seconds = int(time.time())
    id_token_expiration_timestamp = now_in_seconds + one_day_in_seconds
    access_token_expiration_timestamp = now_in_seconds + one_hour_in_seconds

    def userinfo_mock(*args, **kwargs):
        return {"sub": "bad", "email": "foo@bar.com", "exp": id_token_expiration_timestamp}

    monkeypatch.setattr(AuthBackend, "_get_user_info", userinfo_mock)

    resp = client.get(
        reverse("auth-login"),
        HTTP_AUTHORIZATION="Bearer meh",
        HTTP_ID_TOKEN="meh",
        HTTP_ACCESS_TOKEN_EXPIRES_AT=str(access_token_expiration_timestamp),
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Unrecognized identity"


@pytest.mark.django_db
def test_login_not_active(test_ldap_user, client, monkeypatch):
    """Test that login is not permitted if the user has been disabled."""
    now_in_seconds = int(time.time())
    id_token_expiration_timestamp = now_in_seconds + one_day_in_seconds
    access_token_expiration_timestamp = now_in_seconds + one_hour_in_seconds

    def userinfo_mock(*args, **kwargs):
        return {
            "sub": "Mozilla-LDAP",
            "email": test_ldap_user.email,
            "exp": id_token_expiration_timestamp,
        }

    monkeypatch.setattr(AuthBackend, "_get_user_info", userinfo_mock)

    test_ldap_user.is_active = False
    test_ldap_user.save()

    resp = client.get(
        reverse("auth-login"),
        HTTP_AUTHORIZATION="Bearer meh",
        HTTP_ID_TOKEN="meh",
        HTTP_ACCESS_TOKEN_EXPIRES_AT=str(access_token_expiration_timestamp),
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "This user has been disabled."


def test_login_authorization_header_missing(client):
    resp = client.get(reverse("auth-login"))
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Authorization header is expected"


@pytest.mark.parametrize(
    "auth_header_value",
    [
        "foo",
        "Bearer ",
        "Bearer foo bar",
    ],
)
def test_login_authorization_header_malformed(client, auth_header_value):
    resp = client.get(
        reverse("auth-login"),
        HTTP_AUTHORIZATION=auth_header_value,
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Authorization header must be of form 'Bearer {token}'"


def test_login_id_token_header_missing(client):
    resp = client.get(
        reverse("auth-login"),
        HTTP_AUTHORIZATION="Bearer abc",
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Id-Token header is expected"


def test_login_id_token_malformed(client):
    resp = client.get(
        reverse("auth-login"),
        HTTP_AUTHORIZATION="Bearer abc",
        HTTP_ID_TOKEN="aaa",
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Unable to decode the Id token header"


def test_login_id_token_missing_rsa_key_id(client):
    resp = client.get(
        reverse("auth-login"),
        HTTP_AUTHORIZATION="Bearer abc",
        HTTP_ID_TOKEN=(
            # Token generated using:
            # https://jwt.io/#debugger-io
            # With header:
            # {
            #   "alg": "RS256",
            #   "typ": "JWT"
            # }
            # (and default payload)
            "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9."
            + "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ."
            + "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
        ),
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Id token header missing RSA key ID"


def test_login_id_token_unknown_rsa_key_id(client):
    resp = client.get(
        reverse("auth-login"),
        HTTP_AUTHORIZATION="Bearer abc",
        HTTP_ID_TOKEN=(
            # Token generated using:
            # https://jwt.io/#debugger-io
            # With header:
            # {
            #   "alg": "RS256",
            #   "typ": "JWT",
            #   "kid": "1234"
            # }
            # (and default payload)
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjEyMzQifQ."
            + "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ."
            + "Fghd96rsPbzEOGv0mMn4DDBf86PiW_ztPcAbDQoeA6s"
        ),
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Id token using unrecognised RSA key ID"


def test_login_id_token_invalid_signature(client):
    resp = client.get(
        reverse("auth-login"),
        HTTP_AUTHORIZATION="Bearer foo",
        HTTP_ID_TOKEN=(
            # Token generated using:
            # https://jwt.io/#debugger-io
            # With header:
            # {
            #   "alg": "HS256",
            #   "typ": "JWT",
            #   "kid": "MkZDNDcyRkNGRTFDNjlBNjZFOEJBN0ZBNzJBQTNEMDhCMEEwNkFGOA"
            # }
            # (and default payload)
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ik1rWkRORGN5UmtOR1JURkROamxCTmp"
            + "aRk9FSkJOMFpCTnpKQlFUTkVNRGhDTUVFd05rRkdPQSJ9."
            + "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ."
            + "this_signature_is_not_valid"
        ),
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Invalid header: Unable to parse authentication"


def test_login_access_token_expiry_header_missing(client, monkeypatch):
    now_in_seconds = int(time.time())
    id_token_expiration_timestamp = now_in_seconds + one_day_in_seconds

    def userinfo_mock(*args, **kwargs):
        return {"sub": "Mozilla-LDAP", "email": "x@y.z", "exp": id_token_expiration_timestamp}

    monkeypatch.setattr(AuthBackend, "_get_user_info", userinfo_mock)

    resp = client.get(
        reverse("auth-login"),
        HTTP_AUTHORIZATION="Bearer foo",
        HTTP_ID_TOKEN="bar",
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Access-Token-Expires-At header is expected"


def test_login_access_token_expiry_header_malformed(client, monkeypatch):
    now_in_seconds = int(time.time())
    id_token_expiration_timestamp = now_in_seconds + one_day_in_seconds

    def userinfo_mock(*args, **kwargs):
        return {"sub": "Mozilla-LDAP", "email": "x@y.z", "exp": id_token_expiration_timestamp}

    monkeypatch.setattr(AuthBackend, "_get_user_info", userinfo_mock)

    resp = client.get(
        reverse("auth-login"),
        HTTP_AUTHORIZATION="Bearer foo",
        HTTP_ID_TOKEN="bar",
        HTTP_ACCESS_TOKEN_EXPIRES_AT="aaa",
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Access-Token-Expires-At header value is invalid"


def test_login_access_token_expired(client, monkeypatch):
    now_in_seconds = int(time.time())
    id_token_expiration_timestamp = now_in_seconds + one_hour_in_seconds
    access_token_expiration_timestamp = now_in_seconds - 30

    def userinfo_mock(*args, **kwargs):
        return {"sub": "Mozilla-LDAP", "email": "x@y.z", "exp": id_token_expiration_timestamp}

    monkeypatch.setattr(AuthBackend, "_get_user_info", userinfo_mock)

    resp = client.get(
        reverse("auth-login"),
        HTTP_AUTHORIZATION="Bearer foo",
        HTTP_ID_TOKEN="bar",
        HTTP_ACCESS_TOKEN_EXPIRES_AT=str(access_token_expiration_timestamp),
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Session expiry time has already passed!"


def test_login_id_token_expires_before_access_token(test_ldap_user, client, monkeypatch):
    """
    Test that the Django session expiration is set correctly if the Id Token expiration
    is due to occur before the Access Token expires (normally it is the other way around).
    """
    now_in_seconds = int(time.time())
    id_token_expiration_timestamp = now_in_seconds + one_hour_in_seconds
    access_token_expiration_timestamp = now_in_seconds + one_day_in_seconds

    def userinfo_mock(*args, **kwargs):
        return {"sub": "email", "email": test_ldap_user.email, "exp": id_token_expiration_timestamp}

    monkeypatch.setattr(AuthBackend, "_get_user_info", userinfo_mock)

    resp = client.get(
        reverse("auth-login"),
        HTTP_AUTHORIZATION="Bearer meh",
        HTTP_ID_TOKEN="meh",
        HTTP_ACCESS_TOKEN_EXPIRES_AT=str(access_token_expiration_timestamp),
    )
    assert resp.status_code == 200
    assert client.session.get_expiry_age() == pytest.approx(
        min(one_hour_in_seconds, settings.AUTH_MAX_SESSION_AGE_SECONDS), abs=5
    )


# Session expiry cap tests
#
# The Django session cookie is what authorizes every mutating API call, so its
# lifetime bounds how long a user whose SSO access was revoked can keep acting.
# The session is capped at AUTH_MAX_SESSION_AGE_SECONDS so that when the
# frontend's silent renewals stop (e.g. a terminated employee) the session
# lapses within that window rather than coasting on the token's full lifetime.


def test_login_session_capped_when_tokens_outlive_cap(test_ldap_user, client, monkeypatch):
    """When both tokens outlive the cap, the session is capped, not left at ~24h."""
    now_in_seconds = int(time.time())
    long_lived_timestamp = now_in_seconds + one_day_in_seconds

    def userinfo_mock(*args, **kwargs):
        return {"sub": "email", "email": test_ldap_user.email, "exp": long_lived_timestamp}

    monkeypatch.setattr(AuthBackend, "_get_user_info", userinfo_mock)

    resp = client.get(
        reverse("auth-login"),
        HTTP_AUTHORIZATION="Bearer meh",
        HTTP_ID_TOKEN="meh",
        HTTP_ACCESS_TOKEN_EXPIRES_AT=str(long_lived_timestamp),
    )
    assert resp.status_code == 200
    assert client.session.get_expiry_age() == pytest.approx(
        settings.AUTH_MAX_SESSION_AGE_SECONDS, abs=5
    )


def test_login_session_uses_token_expiry_when_shorter_than_cap(test_ldap_user, client, monkeypatch):
    """A token expiring sooner than the cap still wins (the cap only shortens)."""
    now_in_seconds = int(time.time())
    ten_minutes = 10 * 60
    id_token_expiration_timestamp = now_in_seconds + one_day_in_seconds
    access_token_expiration_timestamp = now_in_seconds + ten_minutes

    def userinfo_mock(*args, **kwargs):
        return {
            "sub": "email",
            "email": test_ldap_user.email,
            "exp": id_token_expiration_timestamp,
        }

    monkeypatch.setattr(AuthBackend, "_get_user_info", userinfo_mock)

    resp = client.get(
        reverse("auth-login"),
        HTTP_AUTHORIZATION="Bearer meh",
        HTTP_ID_TOKEN="meh",
        HTTP_ACCESS_TOKEN_EXPIRES_AT=str(access_token_expiration_timestamp),
    )
    assert resp.status_code == 200
    assert client.session.get_expiry_age() == pytest.approx(ten_minutes, abs=5)


# is_staff / sheriff group claim tests
#
# The backend derives is_staff from the SSO groups claim on every /auth/login/,
# including silent token renewals. Silent-renewal tokens frequently omit the
# (large) groups claim entirely, so an absent claim must NOT demote the user --
# otherwise renewals would strip a sheriff's permissions. A claim that IS present
# is authoritative, so it both promotes and demotes.


def _login_with_groups(client, user, groups, monkeypatch):
    """Log `user` in via /auth/login/, injecting `groups` into the id token.

    Pass `groups=None` to omit the groups claim entirely (the silent-renewal
    case). Returns the /auth/login/ response.
    """
    now_in_seconds = int(time.time())
    userinfo = {
        "sub": "Mozilla-LDAP",
        "email": user.email,
        "exp": now_in_seconds + one_day_in_seconds,
    }
    if groups is not None:
        userinfo[GROUPS_CLAIM] = groups

    monkeypatch.setattr(AuthBackend, "_get_user_info", lambda *a, **k: userinfo)

    return client.get(
        reverse("auth-login"),
        HTTP_AUTHORIZATION="Bearer meh",
        HTTP_ID_TOKEN="meh",
        HTTP_ACCESS_TOKEN_EXPIRES_AT=str(now_in_seconds + one_hour_in_seconds),
    )


def test_login_absent_groups_claim_preserves_staff(test_ldap_user, client, monkeypatch):
    """Absent groups claim (e.g. silent renewal) must not demote an existing staff user."""
    test_ldap_user.is_staff = True
    test_ldap_user.save()

    resp = _login_with_groups(client, test_ldap_user, None, monkeypatch)

    assert resp.status_code == 200
    assert resp.json()["is_staff"] is True
    test_ldap_user.refresh_from_db()
    assert test_ldap_user.is_staff is True


def test_login_groups_claim_without_sheriff_demotes(test_ldap_user, client, monkeypatch):
    """A present groups claim lacking a sheriff group is authoritative: demote."""
    test_ldap_user.is_staff = True
    test_ldap_user.save()

    resp = _login_with_groups(
        client, test_ldap_user, ["all_scm_level_1", "all_scm_level_2"], monkeypatch
    )

    assert resp.status_code == 200
    assert resp.json()["is_staff"] is False
    test_ldap_user.refresh_from_db()
    assert test_ldap_user.is_staff is False


def test_login_empty_groups_claim_demotes(test_ldap_user, client, monkeypatch):
    """A present-but-empty groups claim is treated as authoritative: demote."""
    test_ldap_user.is_staff = True
    test_ldap_user.save()

    resp = _login_with_groups(client, test_ldap_user, [], monkeypatch)

    assert resp.status_code == 200
    assert resp.json()["is_staff"] is False
    test_ldap_user.refresh_from_db()
    assert test_ldap_user.is_staff is False


@pytest.mark.parametrize("sheriff_group", ["sheriff", "perf_sheriff"])
def test_login_groups_claim_with_sheriff_promotes(
    test_ldap_user, client, monkeypatch, sheriff_group
):
    """A present groups claim containing a sheriff group promotes a non-staff user."""
    assert test_ldap_user.is_staff is False

    resp = _login_with_groups(
        client, test_ldap_user, ["all_scm_level_1", sheriff_group], monkeypatch
    )

    assert resp.status_code == 200
    assert resp.json()["is_staff"] is True
    test_ldap_user.refresh_from_db()
    assert test_ldap_user.is_staff is True


def _group_names(user):
    return sorted(group.name for group in user.groups.all())


def test_login_mirrors_tracked_groups(test_ldap_user, client, monkeypatch):
    """Tracked groups in the claim are recorded as Django group membership."""
    resp = _login_with_groups(
        client, test_ldap_user, ["all_scm_level_1", "all_scm_level_2", "sheriff"], monkeypatch
    )

    assert resp.status_code == 200
    assert _group_names(test_ldap_user) == ["all_scm_level_1", "all_scm_level_2", "sheriff"]


def test_login_ignores_untracked_groups(test_ldap_user, client, monkeypatch):
    """Groups Treeherder doesn't track are not mirrored."""
    resp = _login_with_groups(
        client,
        test_ldap_user,
        ["all_scm_level_1", "mozilliansorg_something", "team_release"],
        monkeypatch,
    )

    assert resp.status_code == 200
    assert _group_names(test_ldap_user) == ["all_scm_level_1"]


def test_login_removes_revoked_groups(test_ldap_user, client, monkeypatch):
    """A present claim is authoritative: groups it omits are removed."""
    _login_with_groups(client, test_ldap_user, ["all_scm_level_1", "sheriff"], monkeypatch)
    assert _group_names(test_ldap_user) == ["all_scm_level_1", "sheriff"]

    resp = _login_with_groups(client, test_ldap_user, ["all_scm_level_1"], monkeypatch)

    assert resp.status_code == 200
    assert _group_names(test_ldap_user) == ["all_scm_level_1"]


def test_login_absent_groups_claim_preserves_groups(test_ldap_user, client, monkeypatch):
    """Absent groups claim (e.g. silent renewal) must not clear recorded groups."""
    _login_with_groups(client, test_ldap_user, ["all_scm_level_1"], monkeypatch)
    assert _group_names(test_ldap_user) == ["all_scm_level_1"]

    resp = _login_with_groups(client, test_ldap_user, None, monkeypatch)

    assert resp.status_code == 200
    assert _group_names(test_ldap_user) == ["all_scm_level_1"]


def test_login_leaves_untracked_membership_alone(test_ldap_user, client, monkeypatch):
    """Group membership outside the tracked set survives a sync."""
    unrelated = Group.objects.create(name="unrelated_group")
    test_ldap_user.groups.add(unrelated)

    resp = _login_with_groups(client, test_ldap_user, ["all_scm_level_1"], monkeypatch)

    assert resp.status_code == 200
    assert _group_names(test_ldap_user) == ["all_scm_level_1", "unrelated_group"]


def test_login_new_user_gets_groups(db, client, monkeypatch):
    """A user created on first login has their groups recorded too."""
    now_in_seconds = int(time.time())
    monkeypatch.setattr(
        AuthBackend,
        "_get_user_info",
        lambda *a, **k: {
            "sub": "Mozilla-LDAP",
            "email": "newuser@foo.com",
            "exp": now_in_seconds + one_day_in_seconds,
            GROUPS_CLAIM: ["all_scm_level_3", "mozilliansorg_something"],
        },
    )

    resp = client.get(
        reverse("auth-login"),
        HTTP_AUTHORIZATION="Bearer meh",
        HTTP_ID_TOKEN="meh",
        HTTP_ACCESS_TOKEN_EXPIRES_AT=str(now_in_seconds + one_hour_in_seconds),
    )

    assert resp.status_code == 200
    user = User.objects.get(username="mozilla-ldap/newuser@foo.com")
    assert _group_names(user) == ["all_scm_level_3"]


@pytest.mark.parametrize(
    ("groups", "expected_level"),
    [
        ([], 0),
        (["sheriff"], 0),
        (["all_scm_level_1"], 1),
        (["all_scm_level_1", "all_scm_level_2"], 2),
        (["all_scm_level_3"], 3),
        (["all_scm_level_1", "all_scm_level_2", "all_scm_level_3"], 3),
    ],
)
def test_get_scm_level(test_ldap_user, client, monkeypatch, groups, expected_level):
    """get_scm_level reports the highest level held, and 0 when none is known."""
    _login_with_groups(client, test_ldap_user, groups, monkeypatch)

    assert get_scm_level(test_ldap_user) == expected_level


def test_get_scm_level_anonymous():
    """An unauthenticated user has no known level."""
    assert get_scm_level(AnonymousUser()) == 0
    assert get_scm_level(None) == 0
