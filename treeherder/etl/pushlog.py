import logging
import traceback

import newrelic.agent
import requests
from django.core.cache import cache

from treeherder.etl.exceptions import CollectionNotStoredException
from treeherder.etl.push import store_push
from treeherder.model.models import Repository
from treeherder.utils.github import fetch_json

logger = logging.getLogger(__name__)
ONE_WEEK_IN_SECONDS = 604800


def last_push_id_from_server(repo):
    """Obtain the last push ID from a ``Repository`` instance."""
    url = '%s/json-pushes/?version=2' % repo.url
    data = fetch_json(url)
    return data['lastpushid']


class HgPushlogProcess:
    # For more info on Mercurial Pushes, see:
    #   https://mozilla-version-control-tools.readthedocs.io/en/latest/hgmo/pushlog.html

    def extract(self, url):
        try:
            return fetch_json(url)
        except requests.exceptions.HTTPError as e:
            logger.warning("HTTPError %s fetching: %s", e.response.status_code, url)
            raise

    def transform_push(self, push):
        commits = []
        # we only want to ingest the last 200 commits for each push,
        # to protect against the 5000+ commit merges on release day uplift.
        for commit in push['changesets'][-200:]:
            commits.append(
                {'revision': commit['node'], 'author': commit['author'], 'comment': commit['desc'],}
            )

        return {
            'revision': commits[-1]["revision"],
            'author': push['user'],
            'push_timestamp': push['date'],
            'revisions': commits,
        }

    def run(self, source_url, repository_name, changeset=None, last_push_id=None):
        cache_key = '{}:last_push_id'.format(repository_name)
        if not last_push_id:
            # get the last object seen from cache. this will
            # reduce the number of pushes processed every time
            last_push_id = cache.get(cache_key)

        if not changeset and last_push_id:
            startid_url = "{}&startID={}".format(source_url, last_push_id)
            logger.info(
                "Extracted last push for '%s', '%s', from cache, "
                "attempting to get changes only from that point at: %s",
                repository_name,
                last_push_id,
                startid_url,
            )
            # Use the cached ``last_push_id`` value (saved from the last time
            # this API was called) for this repo.  Use that value as the
            # ``startID`` to get all new pushes from that point forward.
            extracted_content = self.extract(startid_url)

            if extracted_content['lastpushid'] < last_push_id:
                # Push IDs from Mercurial are incremental.  If we cached a value
                # from one call to this API, and a subsequent call told us that
                # the ``lastpushid`` is LOWER than the one we have cached, then
                # the Mercurial IDs were reset.
                # In this circumstance, we can't rely on the cached id, so must
                # throw it out and get the latest 10 pushes.
                logger.warning(
                    "Got a ``lastpushid`` value of %s lower than the cached value of %s "
                    "due to Mercurial repo reset. Getting latest changes for '%s' instead",
                    extracted_content['lastpushid'],
                    last_push_id,
                    repository_name,
                )
                cache.delete(cache_key)
                extracted_content = self.extract(source_url)
        else:
            if changeset:
                logger.info(
                    "Getting all pushes for '%s' corresponding to " "changeset '%s'",
                    repository_name,
                    changeset,
                )
                extracted_content = self.extract(source_url + "&changeset=" + changeset)
            else:
                logger.warning(
                    "Unable to get last push from cache for '%s', " "getting all pushes",
                    repository_name,
                )
                extracted_content = self.extract(source_url)

        pushes = extracted_content['pushes']

        # `pushes` could be empty if there are no new ones since we last fetched
        if not pushes:
            return None

        last_push_id = max(map(int, pushes.keys()))
        last_push = pushes[str(last_push_id)]
        top_revision = last_push["changesets"][-1]["node"]

        errors = []
        repository = Repository.objects.get(name=repository_name)

        for push in pushes.values():
            if not push['changesets']:
                # A push without commits means it was marked as obsolete (see bug 1286426).
                # Without them it's not possible to calculate the push revision required for ingestion.
                continue

            try:
                store_push(repository, self.transform_push(push))
            except Exception:
                newrelic.agent.record_exception()
                errors.append(
                    {
                        "project": repository,
                        "collection": "result_set",
                        "message": traceback.format_exc(),
                    }
                )

        if errors:
            raise CollectionNotStoredException(errors)

        if not changeset:
            # only cache the last push if we're not fetching a specific changeset
            cache.set(cache_key, last_push_id, ONE_WEEK_IN_SECONDS)

        return top_revision
