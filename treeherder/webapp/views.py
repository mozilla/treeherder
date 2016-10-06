from django.views.generic import TemplateView


# TODO: remove this template?
class LoginView(TemplateView):
    template_name = 'webapp/persona_login.html'

    def get_context_data(self, **kwargs):
        context = super(LoginView, self).get_context_data(**kwargs)
        # This is the page the user will be redirected after login.
        # Django_browserid will validate this so it's safe to pass it through.
        context['next'] = self.request.GET.get('next')
        return context
