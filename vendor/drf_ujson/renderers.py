from __future__ import unicode_literals
from rest_framework.compat import six
from rest_framework.renderers import BaseRenderer
import ujson


class UJSONRenderer(BaseRenderer):
    """
    Renderer which serializes to JSON.
    Applies JSON's backslash-u character escaping for non-ascii characters.
    """

    media_type = 'application/json'
    format = 'json'
    ensure_ascii = True
    charset = None

    def render(self, data, *args, **kwargs):
        """
        Render `data` into JSON.
        """
        if data is None:
            return bytes()

        ret = ujson.dumps(data, ensure_ascii=self.ensure_ascii)

        # On python 2.x json.dumps() returns bytestrings if ensure_ascii=True,
        # but if ensure_ascii=False, the return type is underspecified,
        # and may (or may not) be unicode.
        # On python 3.x json.dumps() returns unicode stringsself.
        if isinstance(ret, six.text_type):
            return bytes(ret.encode('utf-8'))
        return ret
