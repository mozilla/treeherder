"""
TODO: Extract this module into a dedicated PyPI package, acting as the
    Python variant of https://github.com/taskcluster/taskcluster-lib-scopes
"""


def satisfies_expression(scopeset, expression):
    if not isinstance(scopeset, list):
        raise TypeError("Scopeset must be an array.")

    def is_satisfied(expr):
        if isinstance(expr, str):
            return any([pattern_match(s, expr) for s in scopeset])

        return (
            "AllOf" in expr
            and all([is_satisfied(e) for e in expr["AllOf"]])
            or "AnyOf" in expr
            and any([is_satisfied(e) for e in expr["AnyOf"]])
        )

    return is_satisfied(expression)


def pattern_match(pattern: str, scope):
    if scope == pattern:
        return True

    if pattern.endswith("*"):
        return scope.startswith(pattern[:-1])

    return False
