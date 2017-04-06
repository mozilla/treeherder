from graphene import relay, ObjectType, List, Schema
from graphene_django.filter import DjangoFilterConnectionField
from graphene_django.types import DjangoObjectType

from treeherder.model.models import *


class JobDetailNode(DjangoObjectType):
    class Meta:
        model = JobDetail
        filter_fields = {
            'url': ('exact', 'icontains', 'iendswith', 'endswith')
        }
        interfaces = (relay.Node, )


class JobNode(DjangoObjectType):
    class Meta:
        model = Job
        filter_fields = ('result', 'tier')
        interfaces = (relay.Node, )

    job_details = DjangoFilterConnectionField(JobDetailNode)

    def resolve_job_details(self, args, context, info):
        return JobDetail.objects.filter(job=self, **args)


class PushNode(DjangoObjectType):
    class Meta:
        model = Push
        filter_fields = ('revision', )
        interfaces = (relay.Node, )

    jobs = DjangoFilterConnectionField(JobNode)

    def resolve_jobs(self, args, context, info):
        return Job.objects.filter(push=self, **args)


class BuildPlatformNode(DjangoObjectType):
    class Meta:
        model = BuildPlatform


class MachinePlatformNode(DjangoObjectType):
    class Meta:
        model = MachinePlatform


class MachineNode(DjangoObjectType):
    class Meta:
        model = Machine


class JobTypeNode(DjangoObjectType):
    class Meta:
        model = JobType


class ProductNode(DjangoObjectType):
    class Meta:
        model = Product


class FailureClassificationNode(DjangoObjectType):
    class Meta:
        model = FailureClassification


class Query(ObjectType):
    all_pushes = DjangoFilterConnectionField(PushNode)
    all_jobs = DjangoFilterConnectionField(JobNode)
    all_job_details = DjangoFilterConnectionField(JobDetailNode)
    all_build_platforms = List(BuildPlatformNode)
    all_machine_platforms = List(MachinePlatformNode)
    all_machines = List(MachineNode)
    all_job_types = List(JobTypeNode)
    all_products = List(ProductNode)
    all_failure_classifications = List(FailureClassificationNode)

    def resolve_all_pushes(self, args, context, info):
        return Push.objects.filter(**args)

    def resolve_all_jobs(self, args, context, info):
        return Job.objects.filter(**args)

    def resolve_all_job_details(self, args, context, info):
        return JobDetail.objects.filter(**args)

    def resolve_all_build_platforms(self, args, context, info):
        return BuildPlatform.objects.all()

    def resolve_all_machine_platforms(self, args, context, info):
        return MachinePlatform.objects.all()

    def resolve_all_machines(self, args, context, info):
        return Machine.objects.all()

    def resolve_all_job_types(self, args, context, info):
        return JobType.objects.all()

    def resolve_all_products(self, args, context, info):
        return Product.objects.all()

    def resolve_all_failure_classifications(self, args, context, info):
        return FailureClassification.objects.all()


schema = Schema(query=Query)
