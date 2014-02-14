from nose.tools import eq_

from django_browserid.http import JSONResponse
from django_browserid.tests import TestCase


class JSONResponseTests(TestCase):
    def test_basic(self):
        response = JSONResponse({'blah': 'foo', 'bar': 7})
        self.assert_json_equals(response.content, {'blah': 'foo', 'bar': 7})
        eq_(response.status_code, 200)

        response = JSONResponse(['baz', {'biff': False}])
        self.assert_json_equals(response.content, ['baz', {'biff': False}])
        eq_(response.status_code, 200)

    def test_status(self):
        response = JSONResponse({'blah': 'foo', 'bar': 7}, status=404)
        self.assert_json_equals(response.content, {'blah': 'foo', 'bar': 7})
        eq_(response.status_code, 404)
