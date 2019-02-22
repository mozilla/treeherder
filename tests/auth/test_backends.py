import pytest

from treeherder.auth.backends import (AuthBackend,
                                      AuthenticationFailed)


@pytest.mark.parametrize(
    ('user_info', 'exp_username', 'exp_exception'),
    [({'sub': 'email', 'email': 'biped@mozilla.com'}, 'email/biped@mozilla.com', False),  # email clientId
     ({'sub': 'ad|Mozilla-LDAP|biped', 'email': 'biped@mozilla.com'}, 'mozilla-ldap/biped@mozilla.com', False),  # ldap clientId
     ({'sub': 'oauth2|biped', 'email': 'biped@mozilla.com'}, 'oauth2/biped@mozilla.com', False),  # FirefoxAccount clientId
     ({'sub': 'github|0000', 'email': 'biped@gmail.com'}, 'github/biped@gmail.com', False),  # github clientId
     ({'sub': 'google-oauth2|0000', 'email': 'biped@mozilla.com'}, 'google/biped@mozilla.com', False),  # google clientId
     ({'sub': 'meh', 'email': 'biped@mozilla.com'}, 'None', True),  # invalid clientId, exception
     ])
def test_get_username_from_userinfo(user_info, exp_username, exp_exception):
    tca = AuthBackend()
    if exp_exception:
        with pytest.raises(AuthenticationFailed):
            tca._get_username_from_userinfo(user_info)
    else:
        username = tca._get_username_from_userinfo(user_info)

        assert username == exp_username
