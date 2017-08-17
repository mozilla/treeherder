import pytest

from treeherder.auth.backends import (NoEmailException,
                                      TaskclusterAuthBackend)


@pytest.mark.parametrize(
    ('client_id', 'exp_email', 'exp_exception'),
    [('email/biped@mozilla.com', 'biped@mozilla.com', False),  # email clientId
     ('mozilla-ldap/biped@mozilla.com', "biped@mozilla.com", False),  # ldap clientId
     ('meh/duderino', None, True),  # invalid clientId, exception
     ('email/', None, True),  # invalid clientId, exception
     ('email/mozilla-ldap/foo@bar.com', None, True),  # invalid clientId, exception
     ('email/foo@bar.com <fakeness>', None, True),  # invalid clientId, exception
     ('meh/email/duderino@dude.net', None, True),  # invalid clientId, exception
     ])
def test_extract_email_from_clientid(client_id, exp_email, exp_exception):
    tca = TaskclusterAuthBackend()
    if exp_exception:
        with pytest.raises(NoEmailException):
            tca._extract_email_from_clientid(client_id)
    else:
        email = tca._extract_email_from_clientid(client_id)
        assert email == exp_email
