from django.core.cache import cache
from django.conf import settings
import requests
from thclient import TreeherderRequest, TreeherderResultSetCollection

from .mixins import JsonExtractorMixin, OAuthLoaderMixin
from treeherder.etl.common import generate_revision_hash


class HgPushlogTransformerMixin(object):

    def transform(self, pushlog,  repository):

        # this contain the whole list of transformed pushes

        th_collections = {}

        # iterate over the pushes
        for push in pushlog.values():
            result_set = dict()
            result_set['push_timestamp'] = push['date']

            result_set['revisions'] = []

            # Author of the push/resultset
            result_set['author'] = push['user']

            rev_hash_components = []

            # iterate over the revisions
            for change in push['changesets']:
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
                th_collections[ repository ] = TreeherderResultSetCollection()

            th_resultset = th_collections[ repository ].get_resultset(result_set)
            th_collections[ repository ].add(th_resultset)

        return th_collections


class HgPushlogProcess(HgPushlogTransformerMixin,
                       OAuthLoaderMixin):

    def extract(self, url):
        response = requests.get(url, timeout=settings.TREEHERDER_REQUESTS_TIMEOUT)
        response.raise_for_status()
        return response.json()

    def run(self, source_url, repository):

        # get the last object seen from cache. this will
        # reduce the number of pushes processed every time
        last_push = cache.get("{0}:last_push".format(repository))
        if last_push:
            try:
                # make an attempt to use the last revision cached
                extracted_content = self.extract(
                    source_url+"&fromchange="+last_push
                )
            except requests.exceptions.HTTPError, e:
                # in case of a 404 error, delete the cache key
                # and try it without any parameter
                if e.response.status_code == 404:
                    cache.delete("{0}:last_push".format(repository))
                    extracted_content = self.extract(source_url)
                else:
                    raise e
        else:
            extracted_content = self.extract(source_url)

        if extracted_content:
            last_push_id = max(map(lambda x: int(x), extracted_content.keys()))
            last_push = extracted_content[str(last_push_id)]
            top_revision = last_push["changesets"][0]["node"]

            transformed = self.transform(
                extracted_content,
                repository
            )
            self.load(transformed)

            cache.set("{0}:last_push".format(repository), top_revision)


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
