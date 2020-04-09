import logging
from mozci.errors import ParentPushNotFound

from treeherder.model.models import Push, Repository
from treeherder.webapp.api.serializers import RepositorySerializer, PushSerializer, CommitSerializer

logger = logging.getLogger(__name__)


def get_commit_history(mozciPush, push):
    parent = None
    parent_sha = None
    parent_repo = None
    parent_push = None

    try:
        parent = mozciPush.parent
    except ParentPushNotFound:
        pass

    if parent:
        parent_sha = parent.revs[-1]
        parents = Push.objects.filter(
            repository__name=parent.branch, revision=parent_sha
        ).select_related(
            'repository',
            'repository__repository_group',
        )
        parent_repo = Repository.objects.get(name=parent.branch)
        parent_push = parents[0] if len(parents) else None

    resp = {
        'parentSha': parent_sha,
        'exactMatch': False,
        'parentPushRevision': None,
        'parentRepository': not parent_repo or RepositorySerializer(parent_repo).data,
        'id': None,
        'jobCounts': None,
        'revisions': [
            CommitSerializer(commit).data for commit in push.commits.all().order_by('-id')
        ],
        'revisionCount': push.commits.count(),
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
            }
        )

    return resp
