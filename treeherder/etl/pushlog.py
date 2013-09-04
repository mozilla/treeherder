from .mixins import JsonExtractorMixin, ResultSetsLoaderMixin
from treeherder.etl.common import get_revision_hash


class HgPushlogTransformerMixin(object):

    def transform(self, pushlog,  repository):

        # this contain the whole list of transformed pushes
        result_sets = []

        # iterate over the pushes
        for push in pushlog.values():
            result_set = dict()
            result_set['push_timestamp'] = push['date']

            result_set['revisions'] = []

            rev_hash_components = []

            # iterate over the revisions
            for change in push['changesets']:
                revision = dict()
                revision['revision'] = change['node']
                revision['files'] = change['files']
                revision['author'] = change['author']
                revision['branch'] = change['branch']
                revision['comment'] = change['desc']
                revision['repository'] = repository
                rev_hash_components.append(change['node'])
                rev_hash_components.append(change['branch'])

                # append the revision to the push
                result_set['revisions'].append(revision)

            result_set['revision_hash'] = get_revision_hash(rev_hash_components)

            # append the push the transformed pushlog
            result_sets.append(result_set)

        return result_sets


class HgPushlogProcess(JsonExtractorMixin,
                       HgPushlogTransformerMixin,
                       ResultSetsLoaderMixin):

    def run(self, source_url, project, repository):
        self.load(
            self.transform(
                self.extract(source_url),
                repository
            ),
            project
        )


class GitPushlogTransformerMixin(object):
    def transform(self, source_url):
        pass


class GitPushlogProcess(JsonExtractorMixin,
                        GitPushlogTransformerMixin,
                        ResultSetsLoaderMixin):
    def run(self, source_url, project):
        pass