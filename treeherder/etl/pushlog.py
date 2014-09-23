from django.core.cache import cache

from thclient import TreeherderRequest, TreeherderResultSetCollection

from .mixins import JsonExtractorMixin, OAuthLoaderMixin
from treeherder.etl.common import generate_revision_hash

PUSHLOG_CACHE_KEY = "{0}:last_push"

class HgPushlogTransformerMixin(object):

    def transform(self, pushlog,  repository):

        # this contain the whole list of transformed pushes
        result_sets = []

        # last push available
        if pushlog:
            last_push = max(pushlog.keys())
        else:
            last_push = None

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

        # cache the last push seen
        if last_push:
            cache.set(PUSHLOG_CACHE_KEY.format(repository), last_push)

        return th_collections


class HgPushlogProcess(JsonExtractorMixin,
                       HgPushlogTransformerMixin,
                       OAuthLoaderMixin):

    def run(self, source_url, repository):

        # get the last object seen from cache. this will
        # reduce the number of pushes processed every time
        last_object = cache.get(PUSHLOG_CACHE_KEY.format(repository))
        if last_object:
            source_url += "&startID=" + last_object

        extracted_content = self.extract(source_url)
        if extracted_content:
            self.load(
                self.transform(
                    extracted_content,
                    repository
                )
            )




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
