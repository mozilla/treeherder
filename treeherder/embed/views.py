from django.http import Http404
from django.utils.decorators import method_decorator
from django.views.decorators.clickjacking import xframe_options_exempt
from django.views.generic.base import TemplateView

from treeherder.model.derived import JobsModel
from treeherder.model.models import Push


class ResultsetStatusView(TemplateView):

    template_name = "embed/resultset_status.html"

    def get_context_data(self, **kwargs):
        assert "repository" in kwargs and "revision" in kwargs
        (repository_name, revision) = (kwargs['repository'], kwargs['revision'])
        context = super(ResultsetStatusView, self).get_context_data(**kwargs)
        pushes = Push.objects.filter(
            repository__name=repository_name,
            commits__revision__startswith=revision).values_list(
                'id', flat=True)
        if not len(pushes):
            raise Http404("No resultset found for revision {0}".format(
                revision))
        push_id = pushes[0]
        with JobsModel(repository_name) as jm:
            resultset_status_dict = jm.get_push_status(push_id)
            update_needed = (('pending' in resultset_status_dict) or
                             ('running' in resultset_status_dict) or
                             not resultset_status_dict)
            context['update_needed'] = update_needed
            context['resultset_status_dict'] = resultset_status_dict
        return context

    # TODO: Replace with the class-based method_decorator once using Django 1.9.
    @method_decorator(xframe_options_exempt)
    def dispatch(self, *args, **kwargs):
        return super(ResultsetStatusView, self).dispatch(*args, **kwargs)
