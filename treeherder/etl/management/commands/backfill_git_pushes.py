import logging
import time

from django.core.management.base import BaseCommand
from django.db import transaction

from treeherder.etl.revision_mapper import RevisionMapper
from treeherder.model.models import Commit, Job, Push, Repository, RevisionMapping
from treeherder.utils.queryset import chunked_qs

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        "Re-map push/commit revisions from Mercurial SHAs to Git SHAs "
        "for repositories migrating from hg to git. Requires the repository "
        "to have a git_url configured."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--project",
            help="Specific repository name to process (default: all with git_url set)",
        )
        parser.add_argument(
            "--chunk-size",
            type=int,
            default=500,
            help="Number of pushes to process per chunk (default: 500)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would be done without making changes",
        )
        parser.add_argument(
            "--mapfile",
            help="Path to a cinnabar mapfile for bulk SHA mapping (format: <git-sha> <hg-node> per line)",
        )
        parser.add_argument(
            "--local-git-repo",
            help="Path to a local git clone for extracting hg revision metadata from commit messages",
        )
        parser.add_argument(
            "--rate-limit",
            type=int,
            default=4000,
            help="Max GitHub API requests per hour when using API-based mapping (default: 4000)",
        )
        parser.add_argument(
            "--resume-from-id",
            type=int,
            default=0,
            help="Resume processing from this Push ID (useful for interrupted runs)",
        )
        parser.add_argument(
            "--flip-dvcs-type",
            action="store_true",
            help="After successful re-mapping of all pushes, update the repository "
            "to dvcs_type='git' and url=git_url",
        )

    def handle(self, *args, **options):
        repos = Repository.objects.filter(
            dvcs_type="hg",
            git_url__isnull=False,
            active_status="active",
        )
        if options["project"]:
            repos = repos.filter(name=options["project"])

        if not repos.exists():
            self.stderr.write("No repositories found matching criteria.")
            return

        for repo in repos:
            self.stdout.write(f"\n{'=' * 60}")
            self.stdout.write(f"Processing repository: {repo.name}")
            self.stdout.write(f"  hg URL:  {repo.url}")
            self.stdout.write(f"  git URL: {repo.git_url}")
            self.stdout.write(f"{'=' * 60}")

            mapper = RevisionMapper(repo)

            # Step 1: Populate revision mappings if a mapfile or local repo is provided
            self._populate_mappings(mapper, options)

            # Step 2: Re-map push revisions
            stats = self._remap_pushes(repo, mapper, options)

            # Step 3: Report results
            self._report_results(repo, stats, options)

    def _populate_mappings(self, mapper, options):
        """Populate the RevisionMapping table from available sources."""
        if options["mapfile"]:
            self.stdout.write(f"Loading mappings from mapfile: {options['mapfile']}")
            if not options["dry_run"]:
                count = mapper.populate_from_mapfile(options["mapfile"])
                self.stdout.write(f"  Loaded {count} mappings from mapfile")
            else:
                self.stdout.write("  [dry-run] Would load mappings from mapfile")

        if options["local_git_repo"]:
            self.stdout.write(f"Loading mappings from local git repo: {options['local_git_repo']}")
            if not options["dry_run"]:
                count = mapper.populate_from_git_log(options["local_git_repo"])
                self.stdout.write(f"  Loaded {count} mappings from git log")
            else:
                self.stdout.write("  [dry-run] Would load mappings from git log")

        existing_count = RevisionMapping.objects.filter(repository=mapper.repository).count()
        self.stdout.write(f"  Total mappings in database: {existing_count}")

    def _remap_pushes(self, repo, mapper, options):
        """Re-map Push and Commit revisions from hg to git SHAs."""
        stats = {"total": 0, "remapped": 0, "merged": 0, "failed": 0, "skipped": 0}

        queryset = Push.objects.filter(repository=repo)
        if options["resume_from_id"]:
            queryset = queryset.filter(id__gte=options["resume_from_id"])

        # Track API calls for rate limiting
        api_calls = 0
        rate_limit = options["rate_limit"]
        rate_limit_interval = 3600.0 / rate_limit if rate_limit > 0 else 0

        for chunk in chunked_qs(
            queryset, chunk_size=options["chunk_size"], fields=["id", "revision"]
        ):
            if not chunk:
                break

            for push in chunk:
                stats["total"] += 1

                # Look up git SHA for this push's hg revision
                git_revision = mapper.map_hg_to_git(push.revision)

                if not git_revision:
                    # If no mapfile/local-repo mapping exists, try API
                    # (this counts against rate limit)
                    if rate_limit_interval > 0:
                        time.sleep(rate_limit_interval)
                    api_calls += 1

                    git_revision = mapper.map_hg_to_git(push.revision)
                    if not git_revision:
                        stats["failed"] += 1
                        if stats["failed"] <= 20:
                            logger.warning(
                                "No git mapping for push %d (rev %s) in %s",
                                push.id,
                                push.revision,
                                repo.name,
                            )
                        continue

                if git_revision == push.revision:
                    # Already a git revision (or identical SHA)
                    stats["skipped"] += 1
                    continue

                # Perform the re-mapping
                result = self._remap_push(push, git_revision, mapper, options["dry_run"])
                stats[result] += 1

            self.stdout.write(
                f"  Progress: {stats['total']} processed, "
                f"{stats['remapped']} remapped, {stats['merged']} merged, "
                f"{stats['failed']} failed, {stats['skipped']} skipped "
                f"(last push ID: {chunk[-1].id})"
            )

        return stats

    def _remap_push(self, push, git_revision, mapper, dry_run):
        """Re-map a single push's revision from hg to git.

        Returns 'remapped' or 'merged' depending on the action taken.
        """
        # Check if a push with the git revision already exists
        existing = Push.objects.filter(repository=push.repository, revision=git_revision).first()

        if existing and existing.id != push.id:
            # A push with this git SHA already exists (ingested via git).
            # Merge: move jobs/commits from the hg push to the git push.
            if not dry_run:
                with transaction.atomic():
                    Job.objects.filter(push=push).update(push=existing)

                    for commit in push.commits.all():
                        git_commit_rev = mapper.map_hg_to_git(commit.revision)
                        if (
                            git_commit_rev
                            and not Commit.objects.filter(
                                push=existing, revision=git_commit_rev
                            ).exists()
                        ):
                            commit.revision = git_commit_rev
                            commit.push = existing
                            commit.save()
                        # If the git commit already exists on the target push,
                        # the old commit will be deleted with the push below.

                    push.delete()
            return "merged"
        else:
            # Update revision in place
            if not dry_run:
                with transaction.atomic():
                    Push.objects.filter(id=push.id).update(revision=git_revision)

                    for commit in push.commits.all():
                        git_commit_rev = mapper.map_hg_to_git(commit.revision)
                        if git_commit_rev:
                            Commit.objects.filter(id=commit.id).update(revision=git_commit_rev)
            return "remapped"

    def _report_results(self, repo, stats, options):
        """Report final results and optionally flip the repo to git."""
        self.stdout.write(f"\nResults for {repo.name}:")
        self.stdout.write(f"  Total pushes processed: {stats['total']}")
        self.stdout.write(f"  Successfully remapped:  {stats['remapped']}")
        self.stdout.write(f"  Merged with existing:   {stats['merged']}")
        self.stdout.write(f"  Already correct:        {stats['skipped']}")
        self.stdout.write(f"  Failed (no mapping):    {stats['failed']}")

        if options["dry_run"]:
            self.stdout.write("  [dry-run] No changes were made.")
            return

        if stats["failed"] > 0:
            self.stderr.write(
                f"  WARNING: {stats['failed']} pushes could not be mapped. "
                "Re-run with --mapfile or --local-git-repo to provide mappings."
            )
            if options["flip_dvcs_type"]:
                self.stderr.write("  Skipping dvcs_type flip due to unmapped pushes.")
            return

        if options["flip_dvcs_type"]:
            repo.dvcs_type = "git"
            repo.url = repo.git_url
            repo.branch = repo.git_branch or "main"
            repo.save()
            self.stdout.write(
                f"  Flipped {repo.name} to dvcs_type='git', "
                f"url='{repo.git_url}', branch='{repo.branch}'"
            )
