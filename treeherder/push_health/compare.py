import logging

from treeherder.model.models import Push
from treeherder.webapp.api.serializers import CommitSerializer, PushSerializer

logger = logging.getLogger(__name__)


def get_commit_history(mozciPush, push):
    parent = None
    parent_sha = None
    parent_push = None

    try:
        parent = mozciPush.parent
    except Exception as e:
        logger.error('Could not retrieve parent push because {}'.format(e))
        pass

    if parent:
        parent_sha = parent.revs[-1]
        parents = Push.objects.filter(
            repository__name=parent.branch, revision=parent_sha
        ).select_related('repository')
        parent_push = parents[0] if len(parents) else None

    revisions = [CommitSerializer(commit).data for commit in push.commits.all().order_by('-id')]
    resp = {
        'parentSha': parent_sha,
        'exactMatch': False,
        'parentPushRevision': None,
        'id': None,
        'revisions': revisions,
        'revisionCount': len(revisions),
        'currentPush': PushSerializer(push).data,
    }
    if parent_push:
        resp.update(
            {
                # This will be the revision of the Parent, as long as we could find a Push in
                # Treeherder for it.
                'parentRepository': parent_push.repository.name,
                'parentPushRevision': parent_push.revision,
                'id': parent_push.id,
                'exactMatch': parent_sha == parent_push.revision,
            }
        )

    return resp
