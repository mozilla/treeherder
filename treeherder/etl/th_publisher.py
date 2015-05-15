# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import logging

from django.utils.encoding import python_2_unicode_compatible
from django.conf import settings

from treeherder.client import TreeherderClient

from treeherder.etl.oauth_utils import OAuthCredentials

logger = logging.getLogger(__name__)


def post_treeherder_collections(th_collections):
    errors = []
    for project in th_collections:

        credentials = OAuthCredentials.get_credentials(project)

        cli = TreeherderClient(
            protocol=settings.TREEHERDER_REQUEST_PROTOCOL,
            host=settings.TREEHERDER_REQUEST_HOST,
        )

        logger.info(
            "collection loading request for project {0}: {1}".format(
                project,
                th_collections[project].endpoint_base))
        try:
            cli.post_collection(project, credentials.get('consumer_key'),
                                credentials.get('consumer_secret'),
                                th_collections[project])
        except Exception, e:
            errors.append({
                "project": project,
                "url": th_collections[project].endpoint_base,
                "message": str(e)
            })

    if errors:
        raise CollectionNotLoadedException(errors)


@python_2_unicode_compatible
class CollectionNotLoadedException(Exception):

    def __init__(self, error_list, *args, **kwargs):
        """
        error_list contains dictionaries, each containing
        project, url and message
        """
        super(CollectionNotLoadedException, self).__init__(args, kwargs)
        self.error_list = error_list

    def __str__(self):
        return "\n".join(
            ["[{project}] Error posting data to {url}: {message}".format(
                **error) for error in self.error_list]
        )
