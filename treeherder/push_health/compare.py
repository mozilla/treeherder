import logging
from mozci.push import Push as MozciPush

from treeherder.model.models import Push, Repository
from treeherder.webapp.api.serializers import RepositorySerializer, PushSerializer, CommitSerializer

logger = logging.getLogger(__name__)


def get_commit_history(repository, revision, push):
    mozciPush = MozciPush([revision], repository.name)
    parent = mozciPush.parent
    parent_sha = parent.revs[-1]

    parents = Push.objects.filter(repository__name=parent.branch, revision=parent_sha)
    parent_repo = Repository.objects.get(name=parent.branch)
    parent_push = parents[0] if len(parents) else None

    resp = {
        'parentSha': parent_sha,
        'exactMatch': False,
        'parentPushRevision': None,
        'parentRepository': RepositorySerializer(parent_repo).data,
        'id': None,
        'jobCounts': None,
        'revisions': [CommitSerializer(commit).data for commit in push.commits.all()],
        'revisionCount': push.commits.count(),
        'parentPush': None,
        'currentPush': PushSerializer(push).data,
    }
    if parent_push:
        resp.update(
            {
                # This will be the revision of the Parent, as long as we could find a Push in
                # Treeherder for it.
                'parentPushRevision': parent_push.revision,
                'id': parent_push.id,
                'jobCounts': parent_push.get_status(),
                'exactMatch': parent_sha == parent_push.revision,
                'parentPush': parent_push,
            }
        )
    return resp
