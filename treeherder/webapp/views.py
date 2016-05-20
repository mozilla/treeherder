from django.http import HttpResponse
from django.views.generic import TemplateView, View
import requests

class LoginView(TemplateView):
    template_name = 'webapp/persona_login.html'

    def get_context_data(self, **kwargs):
        context = super(LoginView, self).get_context_data(**kwargs)
        # This is the page the user will be redirected after login.
        # Django_browserid will validate this so it's safe to pass it through.
        context['next'] = self.request.GET.get('next')
        return context


class ReftestAnalyzerView(View):
    """Proxy for the reftest analyzer.

    hg.mozilla.org doesn't serve appropriate Content-Type headers. So proxy
    the content and add the appropriate header.
    """
    ANALYZER_URL = 'https://hg.mozilla.org/mozilla-central/raw-file/tip/layout/tools/reftest/reftest-analyzer.xhtml'

    def get(self):
        r = requests.get(self.ANALYZER_URL, timeout=5)
        response = HttpResponse(content=r.data(), status=r.status_code,
                                content_type='text/html')

        return response