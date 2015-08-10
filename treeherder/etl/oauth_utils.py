import copy
import logging
import os

import simplejson as json

from treeherder import path

logger = logging.getLogger(__name__)


class OAuthCredentials():
    credentials = {}

    param_keys = set([
        'oauth_body_hash',
        'oauth_signature',
        'oauth_consumer_key',
        'oauth_nonce',
        'oauth_timestamp',
        'oauth_signature_method',
        'oauth_version',
        'oauth_token',
        'user'
    ])

    credentials_file = path('etl', 'data', 'credentials.json')

    @classmethod
    def get_parameters(cls, query_params):

        parameters = {}
        for key in cls.param_keys:
            parameters[key] = query_params.get(key, None)
        return parameters

    @classmethod
    def set_credentials(cls, credentials={}):

        # Only get the credentials once
        if not cls.credentials and not credentials:
            credentials_string = os.environ.get('TREEHERDER_CREDENTIALS', None)
            if credentials_string:
                credentials = json.loads(credentials_string)
            else:
                try:
                    with open(cls.credentials_file) as f:
                        credentials_string = f.read()
                        credentials = json.loads(credentials_string)

                except IOError:
                    msg = ('Credentials file not found at {0}.'
                           ' Try running `manage.py export_project_credentials`'
                           ' to generate them').format(cls.credentials_file)

                    logger.error(msg)

                except Exception as e:
                    logger.error(e)
                    raise e

        cls.credentials = credentials

    @classmethod
    def get_credentials(cls, project):
        return copy.deepcopy(cls.credentials.get(project, {}))

    @classmethod
    def get_consumer_secret(cls, project):
        return copy.deepcopy(cls.credentials.get(project, {}))


class OAuthLoaderError(Exception):

    def __init__(self, msg, Errors):
        Exception.__init__(self, msg)
        self.Errors = Errors

if not OAuthCredentials.credentials:

    # Only set the credentials once when the module is loaded
    OAuthCredentials.set_credentials()
