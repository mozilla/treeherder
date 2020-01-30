import logging

from treeherder.etl.common import fetch_json
from treeherder.model.models import (Commit,
                                     Push)
from treeherder.webapp.api.serializers import RepositorySerializer

logger = logging.getLogger(__name__)


def get_response_object(parent_sha, push, repository):
    resp = {
        'parentSha': parent_sha,
        'exactMatch': False,
        'revision': None,
        'repository': RepositorySerializer(repository).data,
        'id': None,
        'jobCounts': None,
    }
    if push:
        resp.update({
            'revision': push.revision,
            'id': push.id,
            'jobCounts': push.get_status(),
            'exactMatch': parent_sha == push.revision,
        })
    return resp


def get_parent(repository, revision, push):
    # This gets the list of revisions for the push.  Treeherder only holds the the last 20 per push, so we may
    # not have the oldest one.
    commits_url = '{}/json-pushes?version=2&full=1&changeset={}'.format(repository.url, revision)

    try:
        parent_resp = list(fetch_json(commits_url)["pushes"].values())[0]
        eldest_commit = parent_resp['changesets'][0]
        parent_sha = eldest_commit['parents'][0]
        parent_pushes = Push.objects.filter(revision=parent_sha)
        len_parents = len(parent_pushes)
        logger.error('len parents {}'.format(len_parents))

        if len_parents == 1:
            parent_push = parent_pushes[0]
            return get_response_object(parent_sha, parent_push, parent_push.repository)

        elif len_parents > 1:
            mc_pushes = parent_pushes.filter(repository__name='mozilla-central')
            if len(mc_pushes):
                logger.error('mc_pushes {}'.format(mc_pushes))
                # we have more than one parent push on mozilla-central.  Just pick the
                # first one.  No way to know which one is more correct.
                mc_push = mc_pushes[0]
                return get_response_object(parent_sha, mc_push, mc_push.repository)

            # we have more than one push that matches, but not one in m-c,
            # so let's see what we have.
            for parent in parent_pushes:
                logger.error('parent with repo {}'.format(parent.repository.name))

        # This parent doesn't have its own push, so look for it in the commits table
        # If there are multiple, we don't have a way to know which is the "right" one,
        # so pick the first.  If the only one is a commit for the push in question, then
        # skip it.
        commits = Commit.objects.filter(revision=revision)
        for commit in commits:
            if commit.push.revision != revision:
                return get_response_object(parent_sha, commit.push, commit.push.repository)

        # We can't find any mention of this commit, so return what we have.  Hope
        # for the best that it's in the same repository as the push in question.
        return get_response_object(parent_sha, None, repository)

    except Exception as e:
        logger.exception(e)
