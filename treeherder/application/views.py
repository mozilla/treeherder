from django.contrib.auth.decorators import login_required
from django.core.urlresolvers import reverse_lazy
from django.utils.decorators import method_decorator
from django.views.generic.edit import CreateView, DeleteView
from django.views.generic import DetailView, ListView

from .forms import ApplicationForm
from .models import Application


class LoginRequiredMixin(object):
    """
    View mixin which requires that the user is authenticated.
    """
    @method_decorator(login_required)
    def dispatch(self, *args, **kwargs):
        return super(LoginRequiredMixin, self).dispatch(*args, **kwargs)


class ApplicationList(LoginRequiredMixin, ListView):
    model = Application

    def get_queryset(self):
        return Application.objects.filter(owner=self.request.user).order_by('-created')


class ApplicationCreate(LoginRequiredMixin, CreateView):
    model = Application
    form_class = ApplicationForm
    success_url = reverse_lazy('application-list')

    def form_valid(self, form):
        form.instance.owner = self.request.user
        return super(ApplicationCreate, self).form_valid(form)


class ApplicationDetail(LoginRequiredMixin, DetailView):
    model = Application

    def get_queryset(self):
        return Application.objects.filter(owner=self.request.user)


class ApplicationDelete(LoginRequiredMixin, DeleteView):
    model = Application
    success_url = reverse_lazy('application-list')
