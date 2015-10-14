import logging
import time

import oauth2 as oauth
from requests.auth import AuthBase

logger = logging.getLogger(__name__)


class TreeherderAuth(AuthBase):
    """Signs a request uri using a 2-legged oauth mechanism"""
    def __init__(self, oauth_key, oauth_secret, user):
        self.oauth_key = oauth_key
        self.oauth_secret = oauth_secret
        self.user = user
        logger.warning('The use of TreeherderAuth is now deprecated. Please switch to using '
                       'Hawk credentials, which are passed directly to TreeherderClient.')

    def __call__(self, r):
        # modify and return the request
        r.url = self.get_signed_uri(r.body, r.url, r.method)
        return r

    def get_signed_uri(self, serialized_body, uri, http_method):

        # There is no requirement for the token in two-legged
        # OAuth but we still need the token object.
        token = oauth.Token(key='', secret='')
        consumer = oauth.Consumer(key=self.oauth_key, secret=self.oauth_secret)

        parameters = {
            'user': self.user,
            'oauth_version': '1.0',
            'oauth_nonce': oauth.generate_nonce(),
            'oauth_timestamp': int(time.time())
        }

        try:
            req = oauth.Request(
                method=http_method,
                body=serialized_body,
                url=uri,
                parameters=parameters
            )
        except AssertionError:
            logger.error('uri: %s' % uri)
            logger.error('body: %s' % serialized_body)
            raise

        signature_method = oauth.SignatureMethod_HMAC_SHA1()
        req.sign_request(signature_method, consumer, token)

        return req.to_url()
