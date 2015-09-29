from django.contrib.auth.decorators import login_required
from django.core.urlresolvers import reverse_lazy
from django.utils.decorators import method_decorator
from django.views.generic import (DetailView,
                                  ListView)
from django.views.generic.edit import (CreateView,
                                       DeleteView)

from .forms import CredentialsForm
from .models import Credentials


class LoginRequiredMixin(object):
    """
    View mixin which requires that the user is authenticated.
    """
    @method_decorator(login_required)
    def dispatch(self, *args, **kwargs):
        return super(LoginRequiredMixin, self).dispatch(*args, **kwargs)


class CredentialsList(LoginRequiredMixin, ListView):
    model = Credentials

    def get_queryset(self):
        return Credentials.objects.filter(owner=self.request.user).order_by('-created')


class CredentialsCreate(LoginRequiredMixin, CreateView):
    model = Credentials
    form_class = CredentialsForm
    success_url = reverse_lazy('credentials-list')

    def form_valid(self, form):
        form.instance.owner = self.request.user
        return super(CredentialsCreate, self).form_valid(form)


class CredentialsDetail(LoginRequiredMixin, DetailView):
    model = Credentials

    def get_queryset(self):
        return Credentials.objects.filter(owner=self.request.user)


class CredentialsDelete(LoginRequiredMixin, DeleteView):
    model = Credentials
    success_url = reverse_lazy('credentials-list')
