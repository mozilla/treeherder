# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import logging

from django.utils.encoding import python_2_unicode_compatible
from django.conf import settings

from treeherder.client import TreeherderRequest

from treeherder.etl.oauth_utils import OAuthCredentials

logger = logging.getLogger(__name__)


def post_treeherder_collections(th_collections):
    errors = []
    chunk_size = settings.TREEHERDER_CLIENT_CHUNK_SIZE

    for project in th_collections:

        credentials = OAuthCredentials.get_credentials(project)

        th_request = TreeherderRequest(
            protocol=settings.TREEHERDER_REQUEST_PROTOCOL,
            host=settings.TREEHERDER_REQUEST_HOST,
            project=project,
            oauth_key=credentials.get('consumer_key', None),
            oauth_secret=credentials.get('consumer_secret', None)
        )

        logger.info(
            "collection loading request: {0}".format(
                th_request.get_uri(th_collections[project].endpoint_base)))

        collection_chunks = th_collections[project].get_chunks(chunk_size)

        for collection in collection_chunks:
            response = th_request.post(collection)

            if not response or response.status_code != 200:
                errors.append({
                    "project": project,
                    "url": th_collections[project].endpoint_base,
                    "message": response.text
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
