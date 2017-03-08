import graphene
from graphene_django.types import DjangoObjectType

from treeherder.model.models import *


class JobGraph(DjangoObjectType):
    class Meta:
        model = Job


class BuildPlatformGraph(DjangoObjectType):
    class Meta:
        model = BuildPlatform


class MachinePlatformGraph(DjangoObjectType):
    class Meta:
        model = MachinePlatform


class MachineGraph(DjangoObjectType):
    class Meta:
        model = Machine


class JobTypeGraph(DjangoObjectType):
    class Meta:
        model = JobType


class ProductGraph(DjangoObjectType):
    class Meta:
        model = Product


class FailureClassificationGraph(DjangoObjectType):
    class Meta:
        model = FailureClassification


class PushGraph(DjangoObjectType):
    class Meta:
        model = Push


class Query(graphene.ObjectType):
    all_jobs = graphene.List(JobGraph)
    all_build_platforms = graphene.List(BuildPlatformGraph)
    all_machine_platforms = graphene.List(MachinePlatformGraph)
    all_machines = graphene.List(MachineGraph)
    all_job_types = graphene.List(JobTypeGraph)
    all_products = graphene.List(ProductGraph)
    all_failure_classifications = graphene.List(FailureClassificationGraph)
    all_pushes = graphene.List(PushGraph)

    def resolve_all_jobs(self, args, context, info):
        return Job.objects.all()

    def resolve_all_build_platforms(self, args, context, info):
        return BuildPlatform.objects.all()

    def resolve_all_machine_platforms(self, args, context, info):
        return BuildPlatform.objects.all()

    def resolve_all_machines(self, args, context, info):
        return BuildPlatform.objects.all()

    def resolve_all_job_types(self, args, context, info):
        return BuildPlatform.objects.all()

    def resolve_all_products(self, args, context, info):
        return BuildPlatform.objects.all()

    def resolve_all_failure_classifications(self, args, context, info):
        return BuildPlatform.objects.all()

    def resolve_all_pushes(self, args, context, info):
        return BuildPlatform.objects.all()


schema = graphene.Schema(query=Query)
