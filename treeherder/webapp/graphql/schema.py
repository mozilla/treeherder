import graphene
from graphene_django.filter import DjangoFilterConnectionField
from graphene_django.types import DjangoObjectType
from graphql.utils.ast_to_dict import ast_to_dict

import helpers
from treeherder.model import error_summary
from treeherder.model.models import *
from treeherder.webapp.graphql.types import ObjectScalar


class JobDetailGraph(DjangoObjectType):
    class Meta:
        model = JobDetail
        filter_fields = {
            'url': ('exact', 'icontains', 'iendswith', 'endswith')
        }
        interfaces = (graphene.relay.Node, )


class TextLogErrorGraph(DjangoObjectType):
    class Meta:
        model = TextLogError

    bug_suggestions = ObjectScalar()

    def resolve_bug_suggestions(self, args, context, info):
        return error_summary.bug_suggestions_line(self)


class TextLogStepGraph(DjangoObjectType):
    class Meta:
        model = TextLogStep


class JobGraph(DjangoObjectType):
    class Meta:
        model = Job
        filter_fields = {
            'id': ['exact'],
            'guid': ['exact'],
            'result': ['exact'],
            'tier': ['exact', 'lt'],
        }
        interfaces = (graphene.relay.Node, )

    job_details = DjangoFilterConnectionField(JobDetailGraph)

    def resolve_job_details(self, args, context, info):
        return JobDetail.objects.filter(job=self, **args)


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


class JobGroupGraph(DjangoObjectType):
    class Meta:
        model = JobGroup


class JobLogGraph(DjangoObjectType):
    class Meta:
        model = JobLog


class FailureLineGraph(DjangoObjectType):
    class Meta:
        model = FailureLine


class GroupGraph(DjangoObjectType):
    class Meta:
        model = Group


class ProductGraph(DjangoObjectType):
    class Meta:
        model = Product


class FailureClassificationGraph(DjangoObjectType):
    class Meta:
        model = FailureClassification


class RepositoryGraph(DjangoObjectType):
    class Meta:
        model = Repository


class OptionCollectionGraph(DjangoObjectType):
    class Meta:
        model = OptionCollection


class OptionGraph(DjangoObjectType):
    class Meta:
        model = Option


class PushGraph(DjangoObjectType):
    class Meta:
        model = Push
        filter_fields = ('revision', )
        interfaces = (graphene.relay.Node, )

    jobs = helpers.OptimizedFilterConnectionField(JobGraph)

    def resolve_jobs(self, args, context, info):
        field_map = {
            "buildPlatform": ("build_platform", "select"),
            "jobLog": ("job_log", "prefetch"),
            "jobType": ("job_type", "select"),
            "jobGroup": ("job_type__job_group", "select"),
            "failureClassification": ("failure_classification", "prefetch"),
            "failureLine": ("job_log__failure_line", "prefetch"),
            "group": ("job_log__failure_line__group", "prefetch"),
            "textLogStep": ("text_log_step", "prefetch"),
            "errors": ("text_log_step__errors", "prefetch"),
        }
        return helpers.optimize(Job.objects.filter(push=self, **args),
                                ast_to_dict(info.field_asts),
                                field_map)


class Query(graphene.ObjectType):
    all_jobs = helpers.OptimizedFilterConnectionField(JobGraph)
    all_job_details = DjangoFilterConnectionField(JobDetailGraph)
    all_build_platforms = graphene.List(BuildPlatformGraph)
    all_machine_platforms = graphene.List(MachinePlatformGraph)
    all_machines = graphene.List(MachineGraph)
    all_option_collections = graphene.List(OptionCollectionGraph)
    all_job_types = graphene.List(JobTypeGraph)
    all_products = graphene.List(ProductGraph)
    all_failure_classifications = graphene.List(FailureClassificationGraph)
    all_pushes = DjangoFilterConnectionField(PushGraph)
    all_text_log_steps = graphene.List(TextLogStepGraph)

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

    def resolve_all_option_collections(self, args, context, info):
        field_map = {
            "option": ("option", "select"),
        }
        return helpers.optimize(OptionCollection.objects.all(),
                                ast_to_dict(info.field_asts),
                                field_map)

    def resolve_all_job_types(self, args, context, info):
        return JobType.objects.all()

    def resolve_all_products(self, args, context, info):
        return Product.objects.all()

    def resolve_all_failure_classifications(self, args, context, info):
        return FailureClassification.objects.all()

    def resolve_all_pushes(self, args, context, info):
        return Push.objects.filter(**args)

    def resolve_all_text_log_steps(self, args, context, info):
        return TextLogStep.objects.filter(**args)


schema = graphene.Schema(query=Query)
