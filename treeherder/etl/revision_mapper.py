import logging
import re
import subprocess

from treeherder.model.models import RevisionMapping
from treeherder.utils.github import get_commit

logger = logging.getLogger(__name__)

# Pattern to extract hg revision from git commit messages.
# Mozilla's hg-to-git migration tools embed the hg changeset ID in commit metadata,
# e.g., "Source-Revision: abc123..." or "hg-hierarchical-rev: abc123..."
SOURCE_REVISION_PATTERNS = [
    re.compile(r"Source-Revision:\s*([0-9a-f]{40})", re.IGNORECASE),
    re.compile(r"hg-hierarchical-rev:\s*([0-9a-f]{40})", re.IGNORECASE),
    re.compile(r"Differential Revision:.*\n.*\n?.*([0-9a-f]{40})", re.IGNORECASE),
]


def parse_github_url(git_url):
    """Extract (owner, repo) from a GitHub URL.

    Supports:
      - https://github.com/owner/repo
      - https://github.com/owner/repo.git
    """
    url = git_url.rstrip("/").replace(".git", "")
    parts = url.split("/")
    return parts[-2], parts[-1]


class RevisionMapper:
    """Maps Mercurial changeset node IDs to Git commit SHAs and vice versa."""

    def __init__(self, repository):
        self.repository = repository
        self.owner, self.repo = parse_github_url(repository.git_url)

    def map_hg_to_git(self, hg_revision):
        """Look up or discover the git SHA for an hg revision.

        Returns the git SHA string, or None if no mapping can be found.
        """
        # 1. Check the RevisionMapping table
        mapping = RevisionMapping.objects.filter(
            repository=self.repository, hg_revision=hg_revision
        ).first()
        if mapping:
            return mapping.git_revision

        # 2. Try to find via commit message metadata in git
        git_sha = self._find_by_commit_metadata(hg_revision)
        if git_sha:
            RevisionMapping.objects.update_or_create(
                repository=self.repository,
                hg_revision=hg_revision,
                defaults={"git_revision": git_sha},
            )
            return git_sha

        return None

    def map_git_to_hg(self, git_revision):
        """Reverse lookup: git SHA -> hg node ID."""
        mapping = RevisionMapping.objects.filter(
            repository=self.repository, git_revision=git_revision
        ).first()
        return mapping.hg_revision if mapping else None

    def _find_by_commit_metadata(self, hg_revision):
        """Search GitHub for a commit whose message contains the hg revision.

        Uses the GitHub search API to find commits that reference the hg SHA
        in their commit message (e.g., via Source-Revision trailers).
        """
        try:
            # GitHub commit search: search commit messages for the hg SHA
            from treeherder.utils.github import fetch_api

            results = fetch_api(
                f"search/commits?q=repo:{self.owner}/{self.repo}+{hg_revision}",
            )
            if results.get("total_count", 0) > 0:
                for item in results["items"]:
                    message = item["commit"]["message"]
                    if hg_revision in message:
                        return item["sha"]
        except Exception:
            logger.debug(
                "GitHub commit search failed for hg rev %s in %s/%s",
                hg_revision,
                self.owner,
                self.repo,
            )
        return None

    def populate_from_mapfile(self, mapfile_path, chunk_size=1000):
        """Bulk-load mappings from a cinnabar mapfile.

        Expected format: one mapping per line, "<git-sha> <hg-node>"
        """
        batch = []
        loaded = 0
        with open(mapfile_path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split()
                if len(parts) < 2:
                    continue
                git_sha, hg_node = parts[0], parts[1]
                batch.append(
                    RevisionMapping(
                        repository=self.repository,
                        hg_revision=hg_node,
                        git_revision=git_sha,
                    )
                )
                if len(batch) >= chunk_size:
                    RevisionMapping.objects.bulk_create(batch, ignore_conflicts=True)
                    loaded += len(batch)
                    logger.info("Loaded %d revision mappings so far", loaded)
                    batch = []
        if batch:
            RevisionMapping.objects.bulk_create(batch, ignore_conflicts=True)
            loaded += len(batch)
        logger.info("Finished loading %d revision mappings from mapfile", loaded)
        return loaded

    def populate_from_git_log(self, local_git_repo_path):
        """Populate mappings by scanning git log for hg revision metadata.

        Requires a local clone of the git repo. Parses commit messages for
        Source-Revision or similar trailers that embed the hg changeset ID.
        """
        result = subprocess.run(
            ["git", "-C", local_git_repo_path, "log", "--format=%H %B%x00"],
            capture_output=True,
            text=True,
            check=True,
        )
        batch = []
        loaded = 0
        for entry in result.stdout.split("\0"):
            entry = entry.strip()
            if not entry:
                continue
            # First 40 chars are the git SHA, rest is commit message
            git_sha = entry[:40]
            message = entry[41:]
            hg_sha = self._extract_hg_revision_from_message(message)
            if hg_sha:
                batch.append(
                    RevisionMapping(
                        repository=self.repository,
                        hg_revision=hg_sha,
                        git_revision=git_sha,
                    )
                )
                if len(batch) >= 1000:
                    RevisionMapping.objects.bulk_create(batch, ignore_conflicts=True)
                    loaded += len(batch)
                    logger.info("Loaded %d revision mappings so far", loaded)
                    batch = []
        if batch:
            RevisionMapping.objects.bulk_create(batch, ignore_conflicts=True)
            loaded += len(batch)
        logger.info("Finished loading %d revision mappings from git log", loaded)
        return loaded

    @staticmethod
    def _extract_hg_revision_from_message(message):
        """Extract an hg revision SHA from a git commit message."""
        for pattern in SOURCE_REVISION_PATTERNS:
            match = pattern.search(message)
            if match:
                return match.group(1)
        return None

    def verify_revision_in_git(self, revision):
        """Check if a revision SHA exists in the Git repo via GitHub API."""
        try:
            get_commit(self.owner, self.repo, revision)
            return True
        except Exception:
            return False

    def verify_revision_in_local_git(self, local_git_repo_path, revision):
        """Check if a revision exists in a local git clone."""
        result = subprocess.run(
            ["git", "-C", local_git_repo_path, "cat-file", "-t", revision],
            capture_output=True,
            text=True,
        )
        return result.returncode == 0 and result.stdout.strip() == "commit"
