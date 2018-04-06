import graphene


class ObjectScalar(graphene.types.scalars.Scalar):
    """
    Un-modeled Object Field for GraphQL data

    This allows an object that's not covered by a model to be returned
    as a field of a graph.
    """

    @staticmethod
    def serialize(dt):
        return dt

    @staticmethod
    def parse_literal(node):
        return node.value

    @staticmethod
    def parse_value(value):
        return value
