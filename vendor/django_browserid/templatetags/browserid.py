from django import template

from fancy_tag import fancy_tag

from django_browserid import helpers


register = template.Library()


@fancy_tag(register, takes_context=True)
def browserid_login(context, **kwargs):
    return helpers.browserid_login(**kwargs)


@fancy_tag(register, takes_context=True)
def browserid_logout(context, **kwargs):
    return helpers.browserid_logout(**kwargs)


@fancy_tag(register, takes_context=True)
def browserid_js(context, **kwargs):
    return helpers.browserid_js(**kwargs)

@fancy_tag(register, takes_context=True)
def browserid_css(context, **kwargs):
    return helpers.browserid_css(**kwargs)
