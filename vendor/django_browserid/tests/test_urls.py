from django.core.urlresolvers import resolve
from django.test.client import RequestFactory
from django.utils.six.moves import reload_module

from mock import Mock

from django_browserid import urls
from django_browserid.tests import TestCase


MyVerifyClass = Mock()


class UrlTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def test_override_verify_class(self):
        # Reload so that the settings.BROWSERID_VERIFY_CLASS takes effect.
        path = 'django_browserid.tests.test_urls.MyVerifyClass'
        with self.settings(BROWSERID_VERIFY_CLASS=path):
            reload_module(urls)

        view = resolve('/browserid/login/', urls).func
        self.assertEqual(view, MyVerifyClass.as_view())

        # Reset urls back to normal.
        reload_module(urls)
