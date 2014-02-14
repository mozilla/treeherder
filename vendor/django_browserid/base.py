# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
import json
import logging
from datetime import datetime

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.utils import six
from django.utils.encoding import python_2_unicode_compatible
from django.utils.http import same_origin

import requests


logger = logging.getLogger(__name__)


@python_2_unicode_compatible
class BrowserIDException(Exception):
    """Raised when there is an issue verifying an assertion."""
    def __init__(self, exc):
        #: Original exception that caused this to be raised.
        self.exc = exc

    def __str__(self):
        return six.text_type(self.exc)


def sanity_checks(request):
    """
    Small checks for common errors.

    Checks are normally only enabled if DEBUG is True. You can
    explicitly disable the checks using the
    BROWSERID_DISABLE_SANITY_CHECKS.

    :returns:
        True if the checks were run, False if they were skipped.
    """
    if getattr(settings, 'BROWSERID_DISABLE_SANITY_CHECKS', not settings.DEBUG):
        return False  # Return value helps us test if the checks ran.

    # SESSION_COOKIE_SECURE should be False in development unless you can
    # use https.
    if settings.SESSION_COOKIE_SECURE and not request.is_secure():
        logger.warning('SESSION_COOKIE_SECURE is currently set to True, '
                       'which may cause issues with django_browserid '
                       'login during local development. Consider setting '
                       'it to False.')

    # If you're using django-csp, you should include persona.
    if 'csp.middleware.CSPMiddleware' in settings.MIDDLEWARE_CLASSES:
        persona = 'https://login.persona.org'
        in_default = persona in getattr(settings, 'CSP_DEFAULT_SRC', None)
        in_script = persona in getattr(settings, 'CSP_SCRIPT_SRC', None)
        in_frame = persona in getattr(settings, 'CSP_FRAME_SRC', None)

        if (not in_script or not in_frame) and not in_default:
            logger.warning('django-csp detected, but %s was not found in '
                           'your CSP policies. Consider adding it to '
                           'CSP_SCRIPT_SRC and CSP_FRAME_SRC',
                           persona)

    return True


def get_audience(request):
    """
    Determine the audience to use for verification from the given request.

    Relies on the BROWSERID_AUDIENCES setting, which is an explicit list of acceptable
    audiences for your site.

    :returns:
        The first audience in BROWSERID_AUDIENCES that has the same origin as the request's
        URL.

    :raises:
        :class:`django.core.exceptions.ImproperlyConfigured`: If BROWSERID_AUDIENCES isn't
        defined, or if no matching audience could be found.
    """
    protocol = 'https' if request.is_secure() else 'http'
    host = '{0}://{1}'.format(protocol, request.get_host())
    try:
        audiences = settings.BROWSERID_AUDIENCES
        if not audiences and settings.DEBUG:
            return host
    except AttributeError:
        if settings.DEBUG:
            return host
        raise ImproperlyConfigured('Required setting BROWSERID_AUDIENCES not found!')

    for audience in audiences:
        if same_origin(host, audience):
            return audience

    # No audience found? We must not be configured properly, otherwise why are we getting this
    # request?
    raise ImproperlyConfigured('No audience could be found in BROWSERID_AUDIENCES for host `{0}`.'
                               .format(host))


@python_2_unicode_compatible
class VerificationResult(object):
    """
    Result of an attempt to verify an assertion.

    VerificationResult objects can be treated as booleans to test if the verification succeeded or
    not.

    The fields returned by the remote verification service, such as ``email`` or ``issuer``, are
    available as attributes if they were included in the response. For example, a failure result
    will raise an AttributeError if you try to access the ``email`` attribute.
    """
    def __init__(self, response):
        """
        :param response:
            Dictionary of the response from the remote verification service.
        """
        self._response = response

    def __getattr__(self, name):
        if name in self._response:
            return self._response[name]
        else:
            raise AttributeError

    @property
    def expires(self):
        """The expiration date of the assertion as a naive :class:`datetime.datetime` in UTC."""
        try:
            return datetime.utcfromtimestamp(int(self._response['expires']) / 1000.0)
        except KeyError:
            raise AttributeError
        except ValueError:
            timestamp = self._response['expires']
            logger.warning('Could not parse expires timestamp: `{0}`'.format(timestamp))
            return timestamp

    def __nonzero__(self):
        return self._response.get('status') == 'okay'

    def __bool__(self):
        return self.__nonzero__()

    def __str__(self):
        result = six.u('Success') if self else six.u('Failure')
        email = getattr(self, 'email', None)
        email_string = six.u(' email={0}').format(email) if email else six.u('')
        return six.u('<VerificationResult {0}{1}>').format(result, email_string)


class RemoteVerifier(object):
    """
    Verifies BrowserID assertions using a remote verification service.

    By default, this uses the Mozilla Persona service for remote verification.
    """
    verification_service_url = 'https://verifier.login.persona.org/verify'
    requests_parameters = {
        'timeout': 5
    }

    def verify(self, assertion, audience, **kwargs):
        """
        Verify an assertion using a remote verification service.

        :param assertion:
            BrowserID assertion to verify.

        :param audience:
            The protocol, hostname and port of your website. Used to confirm that the assertion was
            meant for your site and not for another site.

        :param kwargs:
            Extra keyword arguments are passed on to requests.post to allow customization.

        :returns:
            :class:`.VerificationResult`

        :raises:
            :class:`.BrowserIDException`: Error connecting to the remote verification service, or
            error parsing the response received from the service.
        """
        parameters = dict(self.requests_parameters, **{
            'data': {
                'assertion': assertion,
                'audience': audience,
            }
        })
        parameters['data'].update(kwargs)

        try:
            response = requests.post(self.verification_service_url, **parameters)
        except requests.exceptions.RequestException as err:
            raise BrowserIDException(err)

        try:
            return VerificationResult(response.json())
        except (ValueError, TypeError) as err:
            # If the returned JSON is invalid, log a warning and return a failure result.
            logger.warning('Failed to parse remote verifier response: `{0}`'
                           .format(response.content))
            return VerificationResult({
                'status': 'failure',
                'reason': 'Could not parse verifier response: {0}'.format(err)
            })


class MockVerifier(object):
    """Mock-verifies BrowserID assertions."""

    def __init__(self, email, **kwargs):
        """
        :param email:
            Email address to include in successful verification result. If None, verify will return
            a failure result.

        :param kwargs:
            Extra keyword arguments are used to update successful verification results. This allows
            for mocking attributes on the result, such as the issuer.
        """
        self.email = email
        self.result_attributes = kwargs

    def verify(self, assertion, audience, **kwargs):
        """
        Mock-verify an assertion. The return value is determined by the parameters given to the
        constructor.
        """
        if not self.email:
            return VerificationResult({
                'status': 'failure',
                'reason': 'No email given to MockVerifier.'
            })
        else:
            result = {
                'status': 'okay',
                'audience': audience,
                'email': self.email,
                'issuer': 'mockissuer.example.com:443',
                'expires': '1311377222765'
            }
            result.update(self.result_attributes)
            return VerificationResult(result)
