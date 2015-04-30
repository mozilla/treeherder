# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from django.core.cache import cache
from django.conf import settings
import requests
import logging

from treeherder.client import TreeherderResultSetCollection

from .mixins import JsonExtractorMixin, OAuthLoaderMixin
from treeherder.etl.common import generate_revision_hash, get_not_found_onhold_push


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
                # we need to get the short version of a revision
                # because buildapi doesn't provide the long one
                # and we need to match it
                revision['revision'] = change['node'][0:12]
                revision['files'] = change['files']
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

    def extract(self, url):
        response = requests.get(url, timeout=settings.TREEHERDER_REQUESTS_TIMEOUT)
        response.raise_for_status()
        return response.json()

    def run(self, source_url, repository, changeset=None):

        # get the last object seen from cache. this will
        # reduce the number of pushes processed every time
        last_push = cache.get("{0}:last_push".format(repository))
        if not changeset and last_push:
            logger.info("Extracted last push for '%s', '%s', from cache, "
                        "attempting to get changes only from that point" %
                        (repository, last_push))
            try:
                # make an attempt to use the last revision cached
                extracted_content = self.extract(
                    source_url + "&fromchange=" + last_push
                )
            except requests.exceptions.HTTPError as e:
                # in case of a 404 error, delete the cache key
                # and try it without any parameter
                if e.response.status_code == 404:
                    logger.warning("Got a 404 fetching changes since '%s', "
                                   "getting all changes for '%s' instead" %
                                   (last_push, repository))
                    cache.delete("{0}:last_push".format(repository))
                    extracted_content = self.extract(source_url)
                else:
                    raise e
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

        if extracted_content:
            last_push_id = max(map(lambda x: int(x), extracted_content.keys()))
            last_push = extracted_content[str(last_push_id)]
            top_revision = last_push["changesets"][-1]["node"]

            transformed = self.transform(
                extracted_content,
                repository
            )
            self.load(transformed)

            if not changeset:
                # only cache the last push if we're not fetching a specific
                # changeset
                cache.set("{0}:last_push".format(repository), top_revision)

            return top_revision

        return None


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
            response.raise_for_status()
        return response.json()

    def run(self, source_url, repository, revision):

        try:
            extracted_content = self.extract(source_url, revision)

            if extracted_content:

                transformed = self.transform(
                    extracted_content,
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
