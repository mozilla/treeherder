from django.views.generic import TemplateView


class LoginView(TemplateView):
    template_name = 'webapp/persona_login.html'

    def get_context_data(self, **kwargs):
        context = super(LoginView, self).get_context_data(**kwargs)
        context['next'] = self.request.GET.get('next')
        return context
