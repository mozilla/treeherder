from collections import defaultdict

from django.contrib.auth.models import User
from django.db import models
from django.db.models import Q
from django.utils.encoding import python_2_unicode_compatible

from jsonfield import JSONField

from django_ci.models import JobExclusion, ReferenceDataSignatures


@python_2_unicode_compatible
class ExclusionProfile(models.Model):

    """
    An exclusion profile represents a list of job exclusions that can be associated with a user profile.
    """
    name = models.CharField(max_length=255, unique=True)
    is_default = models.BooleanField(default=False)
    exclusions = models.ManyToManyField(JobExclusion, related_name="profiles")
    flat_exclusion = JSONField(blank=True, default={})
    author = models.ForeignKey(User, related_name="exclusion_profiles_authored")

    def save(self, *args, **kwargs):
        super(ExclusionProfile, self).save(*args, **kwargs)

        self.update_flat_exclusions()

        # update the old default profile
        if self.is_default:
            ExclusionProfile.objects.filter(is_default=True).exclude(
                id=self.id).update(is_default=False)

    def update_flat_exclusions(self):
        # this is necessary because the ``job_types`` come back in the form of
        # ``Mochitest (18)`` or ``Reftest IPC (Ripc)`` so we must split these
        # back out.
        # same deal for ``platforms``
        # todo: update if/when chunking policy changes
        # when we change chunking, we will likely only get back the name,
        # so we'll just compare that to the ``job_type_name`` field.
        def split_combo(combos):
            list1 = []
            list2 = []
            for combo in combos:
                first, sep, second = combo.rpartition(' (')
                list1.append(first)
                list2.append(second.rstrip(')'))
            return list1, list2

        query = None
        for exclusion in self.exclusions.all().select_related("info"):
            info = exclusion.info
            option_collection_hashes = info['option_collection_hashes']
            job_type_names, job_type_symbols = split_combo(info['job_types'])
            platform_names, platform_arch = split_combo(info['platforms'])
            new_query = Q(repository__in=info['repos'],
                          machine_platform__in=platform_names,
                          job_type_name__in=job_type_names,
                          job_type_symbol__in=job_type_symbols,
                          option_collection_hash__in=option_collection_hashes)
            query = (query | new_query) if query else new_query

        self.flat_exclusion = {}

        if query:
            signatures = ReferenceDataSignatures.objects.filter(query).values_list(
                'repository', 'signature')

            self.flat_exclusion = defaultdict(list)

            # group the signatures by repo, so the queries don't have to be
            # so long when getting jobs
            for repo, sig in signatures:
                self.flat_exclusion[repo].append(sig)

        super(ExclusionProfile, self).save(
            force_insert=False,
            force_update=True
        )

    def __str__(self):
        return self.name
