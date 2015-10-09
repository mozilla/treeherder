import logging

import requests
from django.conf import settings
from django.core.cache import cache

from treeherder.client import TreeherderResultSetCollection
from treeherder.etl.common import (generate_revision_hash,
                                   get_not_found_onhold_push)

from .mixins import (JsonExtractorMixin,
                     OAuthLoaderMixin)

logger = logging.getLogger(__name__)


class HgPushlogTransformerMixin(object):

    def transform(self, pushlog, repository):

        # this contain the whole list of transformed pushes

        th_collections = {}

        # iterate over the pushes
        for push in pushlog.values():
            result_set = dict()
            result_set['push_timestamp'] = push['date']

            result_set['revisions'] = []

            # Author of the push/resultset
            result_set['author'] = push['user']

            result_set['active_status'] = push.get('active_status', 'active')

            rev_hash_components = []

            # iterate over the revisions
            # we only want to ingest the last 200 revisions.
            for change in push['changesets'][-200:]:
                revision = dict()
                revision['revision'] = change['node']
                revision['author'] = change['author']
                revision['branch'] = change['branch']
                revision['comment'] = change['desc']
                revision['repository'] = repository
                rev_hash_components.append(change['node'])
                rev_hash_components.append(change['branch'])

                # append the revision to the push
                result_set['revisions'].append(revision)

            result_set['revision_hash'] = generate_revision_hash(rev_hash_components)

            if repository not in th_collections:
                th_collections[repository] = TreeherderResultSetCollection()

            th_resultset = th_collections[repository].get_resultset(result_set)
            th_collections[repository].add(th_resultset)

        return th_collections


class HgPushlogProcess(HgPushlogTransformerMixin,
                       OAuthLoaderMixin):
    # For more info on Mercurial Pushes, see:
    #   https://mozilla-version-control-tools.readthedocs.org/en/latest/hgmo/pushlog.html

    def extract(self, url):
        response = requests.get(url, timeout=settings.TREEHERDER_REQUESTS_TIMEOUT)
        try:
            response.raise_for_status()
        except requests.exceptions.HTTPError:
            logger.warning("HTTPError %s fetching: %s", response.status_code, url)
            raise
        return response.json()

    def run(self, source_url, repository, changeset=None):

        # get the last object seen from cache. this will
        # reduce the number of pushes processed every time
        last_push_id = cache.get("{0}:last_push_id".format(repository))
        if not changeset and last_push_id:
            startid_url = "{}&startID={}".format(source_url, last_push_id)
            logger.info("Extracted last push for '%s', '%s', from cache, "
                        "attempting to get changes only from that point at: %s" %
                        (repository, last_push_id, startid_url))
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
                logger.warning(("Got a ``lastpushid`` value of {} lower than "
                                "the cached value of {} due to Mercurial repo reset.  "
                                "Getting latest changes for '{}' instead").format(
                                    extracted_content['lastpushid'],
                                    last_push_id,
                                    repository
                                    )
                               )
                cache.delete("{0}:last_push_id".format(repository))
                extracted_content = self.extract(source_url)
        else:
            if changeset:
                logger.info("Getting all pushes for '%s' corresponding to "
                            "changeset '%s'" % (repository, changeset))
                extracted_content = self.extract(source_url + "&changeset=" +
                                                 changeset)
            else:
                logger.warning("Unable to get last push from cache for '%s', "
                               "getting all pushes" % repository)
                extracted_content = self.extract(source_url)

        # ``pushes`` could be empty if there are no new ones since we last
        # fetched
        pushes = extracted_content['pushes']

        if not pushes:
            return None

        last_push_id = max(map(lambda x: int(x), pushes.keys()))
        last_push = pushes[str(last_push_id)]
        top_revision = last_push["changesets"][-1]["node"]
        transformed = self.transform(pushes, repository)
        self.load(transformed)

        if not changeset:
            # only cache the last push if we're not fetching a specific
            # changeset
            cache.set("{0}:last_push_id".format(repository), last_push_id)

        return top_revision


class MissingHgPushlogProcess(HgPushlogTransformerMixin,
                              OAuthLoaderMixin):

    def extract(self, url, revision):
        logger.info("extracting missing resultsets: {0}".format(url))
        response = requests.get(url, timeout=settings.TREEHERDER_REQUESTS_TIMEOUT)
        if response.status_code == 404:
            # we will sometimes get here because builds4hr/pending/running have a
            # job with a resultset that json-pushes doesn't know about.  So far
            # I have only found this to be the case when it uses a revision from
            # the wrong repo.  For example: mozilla-central, but l10n.  The l10n
            # is a separate repo, but buildbot shows it as the same.  So we
            # create this dummy resultset with ``active_status`` of ``onhold``.
            #
            # The effect of this is that we won't keep trying to re-fetch
            # the bogus pushlog, but the jobs are (correctly) not shown in the
            # UI, since they're bad data.
            logger.warn(("no pushlog in json-pushes.  generating a dummy"
                         " onhold placeholder: {0}").format(url))

            # we want to make a "dummy" resultset that is "onhold",
            # because json-pushes doesn't know about it.
            # This is, in effect, what TBPL does.
            # These won't show in the UI, because they only fetch "active"
            # resultsets
            return get_not_found_onhold_push(url, revision)
        else:
            try:
                response.raise_for_status()
            except requests.exceptions.HTTPError:
                logger.warning("HTTPError %s fetching: %s", response.status_code, url)
                raise
        return response.json()

    def run(self, source_url, repository, revision):

        try:
            extracted_content = self.extract(source_url, revision)

            if extracted_content:

                transformed = self.transform(
                    extracted_content['pushes'],
                    repository
                )

                for project, coll in transformed.iteritems():
                    logger.info("loading missing resultsets for {0}: {1}".format(
                        project,
                        coll.to_json()))

                self.load(transformed)
                logger.info("done loading missing resultsets for {0}".format(repository))
            else:
                assert extracted_content, (
                    "Got no content response for missing resultsets: {0}".format(
                        source_url)
                )
        except Exception:
            logger.exception("error loading missing resultsets: {0}".format(
                source_url
            ))
            raise


class GitPushlogTransformerMixin(object):

    def transform(self, source_url):
        # TODO: implement git sources.xml transformation logic
        pass


class GitPushlogProcess(JsonExtractorMixin,
                        GitPushlogTransformerMixin,
                        OAuthLoaderMixin):

    def run(self, source_url, project):
        # TODO: implement the whole sources.xml ingestion process
        pass
