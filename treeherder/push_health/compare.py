import logging

from treeherder.model.models import Commit, Push
from treeherder.utils.http import fetch_json
from treeherder.webapp.api.serializers import RepositorySerializer

logger = logging.getLogger(__name__)


def get_response_object(parent_sha, revisions, revision_count, push, repository):
    """Build a response object that shows the parent and commit history.

    parent_sha -- The SHA of the parent of the latest commit
    revisions -- The revisions/commits of the current Push
    revision_count -- The count of those revisions (may be different from len(revisions)
        because we only keep so many actual revisions in Treeherder, even if the Push has
        more.
    push -- The Push for the parent.  This might be the actual parent Push, or the closest
        thing we could find.  Could also be the Push for the commit of the `parent_sha`.
    repository -- The repository of the parent.  If we can't find a parent Push, then this
        will be the repository of the current Push.
    """

    resp = {
        'parentSha': parent_sha,
        'exactMatch': False,
        'parentPushRevision': None,
        'parentRepository': RepositorySerializer(repository).data,
        'id': None,
        'jobCounts': None,
        'revisions': revisions,
        'revisionCount': revision_count,
        'parentPush': None,
    }
    if push:
        resp.update(
            {
                # This will be the revision of the Parent, as long as we could find a Push in
                # Treeherder for it.
                'parentPushRevision': push.revision,
                'id': push.id,
                'jobCounts': push.get_status(),
                'exactMatch': parent_sha == push.revision,
                'parentPush': push,
            }
        )
    return resp


def commit_to_revision(commit):
    return {
        'comments': commit['desc'],
        'author': commit['author'],
        'revision': commit['node'],
    }


def get_commits(repository, revision):
    # This gets the list of revisions for the push.  Treeherder only holds the the last 20 per push, so we may
    # not have the oldest one.
    try:
        autorel_resp = fetch_json(
            'https://hg.mozilla.org/{}/json-automationrelevance/{}'.format(
                repository.name, revision
            )
        )

        return list(autorel_resp["changesets"])
    except Exception:
        # fallback to using json-pushes

        try:
            json_pushes_resp = fetch_json(
                '{}/json-pushes?version=2&full=1&changeset={}'.format(repository.url, revision)
            )
            changesets = list(json_pushes_resp["pushes"].values())[0]['changesets']
            changesets.reverse()

            return changesets
        except Exception as json_push_ex:
            raise json_push_ex


def get_commit_history(repository, revision, push):
    commits = get_commits(repository, revision) or []
    revisions = [commit_to_revision(commit) for commit in commits]
    revision_count = push.commits.count()
    parent_sha = commits[0]['parents'][0]
    parent_pushes = Push.objects.filter(revision=parent_sha)
    len_parents = len(parent_pushes)

    if len_parents == 1:
        parent_push = parent_pushes[0]
        return get_response_object(
            parent_sha, revisions, revision_count, parent_push, parent_push.repository
        )

    elif len_parents > 1:
        mc_pushes = parent_pushes.filter(repository__name='mozilla-central')
        if len(mc_pushes):
            # we have more than one parent push on mozilla-central.  Just pick the
            # first one.  No way to know which one is more correct.
            mc_push = mc_pushes[0]
            return get_response_object(
                parent_sha, revisions, revision_count, mc_push, mc_push.repository
            )

    # This parent doesn't have its own push, so look for it in the commits table
    # If there are multiple, we don't have a way to know which is the "right" one,
    # so pick the first.  If the only one is a commit for the push in question, then
    # skip it.
    commits = Commit.objects.filter(revision=revision)
    for commit in commits:
        if commit.push.revision != revision:
            return get_response_object(
                parent_sha, commits, revision_count, commit.push, commit.push.repository
            )

    # We can't find any mention of this commit, so return what we have.  Hope
    # for the best that it's in the same repository as the push in question.
    return get_response_object(parent_sha, revisions, revision_count, None, repository)
