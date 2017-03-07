import graphene
from graphene_django import DjangoObjectType
from graphene_django.filter import DjangoFilterConnectionField

from treeherder.model.models import BuildPlatform


class BuildPlatformNode(DjangoObjectType):
    class Meta:
        model = BuildPlatform
        filter_fields = ['id', 'os_name', 'platform', 'architecture']
        interfaces = (graphene.relay.Node, )

# class BuildPlatformType(graphene.ObjectType):
# 	name = 'BuildPlatform'
# 	description = '...'
# 	os_name = graphene.String()
# 	platform = graphene.String()
# 	architecture = graphene.String()


class Query(graphene.ObjectType):
    name = 'Query'
    description = '...'
    # build_platform = graphene.Field(
    # 	BuildPlatformType,
    # 	id = graphene.String()
    # )

    # def resolve_build_platform(self, root, args, info):
    # 	id = args.get('id')
    # 	return BuildPlatform.objects.get(pk=id)
    build_platform = graphene.relay.Node.Field(BuildPlatformNode)
    all_build_platform = DjangoFilterConnectionField(BuildPlatformNode)


schema = graphene.Schema(query=Query)
