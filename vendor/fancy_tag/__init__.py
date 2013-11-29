from inspect import getargspec
import re

from django.conf import settings
from django.template import Node, Variable, VariableDoesNotExist, generic_tag_compiler
from django.template import TemplateSyntaxError, ALLOWED_VARIABLE_CHARS
from django.utils.functional import curry

kwarg_re = re.compile(r'([^\'"]*)=(.*)')


def fancy_tag_compiler(params, defaults, takes_var_args, takes_var_kwargs, takes_context, name, node_class, parser, token):
    "Returns a template.Node subclass."
    bits = token.split_contents()[1:]

    if takes_context:
        if 'context' in params[:1]:
            params = params[1:]
        else:
            raise TemplateSyntaxError(
                "Any tag function decorated with takes_context=True "
                "must have a first argument of 'context'")

    # Split args and kwargs
    args = []
    kwargs = {}
    kwarg_found = False
    unhandled_params = list(params)
    handled_params = []
    if len(bits) > 1 and bits[-2] == 'as':
        output_var = bits[-1]
        if len(set(output_var) - set(ALLOWED_VARIABLE_CHARS)) > 0:
            raise TemplateSyntaxError("%s got output var name with forbidden chars: '%s'" % (name, output_var))
        bits = bits[:-2]
    else:
        output_var = None
    for bit in bits:
        kwarg_match = kwarg_re.match(bit)
        if kwarg_match:
            kw, var = kwarg_match.groups()
            if kw not in params and not takes_var_kwargs:
                raise TemplateSyntaxError("%s got unknown keyword argument '%s'" % (name, kw))
            elif kw in handled_params:
                raise TemplateSyntaxError("%s got multiple values for keyword argument '%s'" % (name, kw))
            else:
                kwargs[str(kw)] = var
                kwarg_found = True
                handled_params.append(kw)
        else:
            if kwarg_found:
                raise TemplateSyntaxError("%s got non-keyword arg after keyword arg" % name)
            else:
                args.append(bit)
                try:
                    handled_params.append(unhandled_params.pop(0))
                except IndexError:
                    if not takes_var_args:
                        raise TemplateSyntaxError("%s got too many arguments" % name)
    # Consider the last n params handled, where n is the number of defaults.
    if defaults is not None:
        unhandled_params = unhandled_params[:-len(defaults)]
    if len(unhandled_params) == 1:
        raise TemplateSyntaxError("%s didn't get a value for argument '%s'" % (name, unhandled_params[0]))
    elif len(unhandled_params) > 1:
        raise TemplateSyntaxError("%s didn't get values for arguments: %s" % (
                name, ', '.join(["'%s'" % p for p in unhandled_params])))

    return node_class(args, kwargs, output_var, takes_context)


def fancy_tag(library, takes_context=False):
    def inner(func):
        params, var_args_var, var_kwargs_var, defaults = getargspec(func)

        class FancyNode(Node):
            def __init__(self, vars_to_resolve, kw_vars_to_resolve, output_var, takes_context):
                self.vars_to_resolve = map(Variable, vars_to_resolve)
                self.kw_vars_to_resolve = dict(
                        [(kw, Variable(var)) for kw, var in kw_vars_to_resolve.items()])
                self.output_var = output_var
                self.takes_context = takes_context

            def safe_resolve(self, var, context):
                try:
                    return var.resolve(context)
                except VariableDoesNotExist:
                    return settings.TEMPLATE_STRING_IF_INVALID

            def render(self, context):
                args = [self.safe_resolve(var, context) for var in self.vars_to_resolve]
                kwargs = dict(
                        [(kw, self.safe_resolve(var, context)) for kw, var in self.kw_vars_to_resolve.items()])

                if self.takes_context:
                    args = [context] + args

                if self.output_var is not None:
                    context[self.output_var] = func(*args, **kwargs)
                    return ''
                else:
                    return func(*args, **kwargs)

        compile_func = curry(
                fancy_tag_compiler,
                params,
                defaults,
                var_args_var is not None,
                var_kwargs_var is not None,
                takes_context,
                getattr(func, "_decorated_function", func).__name__,
                FancyNode
                )
        compile_func.__doc__ = func.__doc__
        library.tag(getattr(func, "_decorated_function", func).__name__, compile_func)
        return func
    return inner
