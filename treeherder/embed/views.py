from django.http import Http404
from django.utils.decorators import method_decorator
from django.views.decorators.clickjacking import xframe_options_exempt
from django.views.generic.base import TemplateView

from treeherder.model.models import Push


@method_decorator(xframe_options_exempt, name='dispatch')
class PushStatusView(TemplateView):

    template_name = "embed/push_status.html"

    def get_context_data(self, repository, revision, **kwargs):
        context = super(PushStatusView, self).get_context_data(
            repository=repository, revision=revision, **kwargs
        )
        pushes = Push.objects.filter(
            repository__name=repository,
            commits__revision__startswith=revision
        )
        if not len(pushes):
            raise Http404("No push found for revision {0}".format(
                revision))
        push_status_dict = pushes[0].get_status()
        update_needed = (('pending' in push_status_dict) or
                         ('running' in push_status_dict) or
                         not push_status_dict)
        context['update_needed'] = update_needed
        context['resultset_status_dict'] = push_status_dict
        return context

    def dispatch(self, *args, **kwargs):
        return super(PushStatusView, self).dispatch(*args, **kwargs)
