# encoding: utf-8
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
#
# Contact: Kyle Lahnakoski (kyle@lahnakoski.com)
#

# MIMICS THE requests API (http://docs.python-requests.org/en/latest/)
# DEMANDS data IS A JSON-SERIALIZABLE STRUCTURE
# WITH ADDED default_headers THAT CAN BE SET USING mo_logs.settings
# EG
# {"debug.constants":{
#     "mo_http.http.default_headers":{"From":"klahnakoski@mozilla.com"}
# }}


from __future__ import absolute_import, division

import zipfile
from contextlib import closing
from copy import copy
from mmap import mmap
from numbers import Number
from tempfile import TemporaryFile

from mo_files import mimetype

import mo_math
from mo_dots import Data, Null, coalesce, is_list, set_default, unwrap, to_data, is_sequence
from mo_files.url import URL
from mo_future import PY2, is_text, text
from mo_future import StringIO
from mo_json import json2value, value2json
from mo_kwargs import override
from mo_logs import Log
from mo_logs.exceptions import Except
from mo_threads import Lock, Till
from mo_times import Timer, Duration
from requests import Response, sessions

from mo_http.big_data import ibytes2ilines, icompressed2ibytes, safe_size, ibytes2icompressed, bytes2zip, zip2bytes

DEBUG = False
FILE_SIZE_LIMIT = 100 * 1024 * 1024
MIN_READ_SIZE = 8 * 1024
ZIP_REQUEST = False

default_headers = Data()  # TODO: MAKE THIS VARIABLE A SPECIAL TYPE OF EXPECTED MODULE PARAMETER SO IT COMPLAINS IF NOT SET
default_timeout = 600
DEFAULTS = {
    "allow_redirects": True,
    "stream": True,
    "verify": True,
    "timeout": 600,
    "zip": False,
    "retry": {"times": 1, "sleep": 0, "http": False}
}
_warning_sent = False
request_count = 0


@override
def request(method, url, headers=None, data=None, json=None, zip=None, retry=None, timeout=None, session=None, kwargs=None):
    """
    JUST LIKE requests.request() BUT WITH DEFAULT HEADERS AND FIXES
    DEMANDS data IS ONE OF:
    * A JSON-SERIALIZABLE STRUCTURE, OR
    * LIST OF JSON-SERIALIZABLE STRUCTURES, OR
    * None

    :param method: GET, POST, etc
    :param url: URL
    :param headers: dict OF HTTP REQUEST HEADERS
    :param data: BYTES (OR GENERATOR OF BYTES)
    :param json: JSON-SERIALIZABLE STRUCTURE
    :param zip: ZIP THE REQUEST BODY, IF BIG ENOUGH
    :param retry: {"times": x, "sleep": y} STRUCTURE
    :param timeout: SECONDS TO WAIT FOR RESPONSE
    :param session: Session OBJECT, IF YOU HAVE ONE
    :param kwargs: ALL PARAMETERS (DO NOT USE)
    :return:
    """
    global _warning_sent
    global request_count

    if not _warning_sent and not default_headers:
        Log.warning(text(
            "The mo_http.http module was meant to add extra " +
            "default headers to all requests, specifically the 'Referer' " +
            "header with a URL to the project. Use the `mo_logs.constants.set()` " +
            "function to set `mo_http.http.default_headers`"
        ))
    _warning_sent = True

    if is_list(url):
        # TRY MANY URLS
        failures = []
        for remaining, u in countdown(url):
            try:
                response = request(url=u, kwargs=kwargs)
                if mo_math.round(response.status_code, decimal=-2) not in [400, 500]:
                    return response
                if not remaining:
                    return response
            except Exception as e:
                e = Except.wrap(e)
                failures.append(e)
        Log.error(u"Tried {{num}} urls", num=len(url), cause=failures)

    if session:
        close_after_response = Null
    else:
        close_after_response = session = sessions.Session()

    with closing(close_after_response):
        if PY2 and is_text(url):
            # httplib.py WILL **FREAK OUT** IF IT SEES ANY UNICODE
            url = url.encode('ascii')

        try:
            set_default(kwargs, DEFAULTS)

            # HEADERS
            headers = unwrap(set_default(headers, session.headers, default_headers))
            _to_ascii_dict(headers)

            # RETRY
            retry = to_data(retry)
            if retry == None:
                retry = set_default({}, DEFAULTS['retry'])
            elif isinstance(retry, Number):
                retry = set_default({"times": retry}, DEFAULTS['retry'])
            elif isinstance(retry.sleep, Duration):
                retry.sleep = retry.sleep.seconds

            # JSON
            if json != None:
                data = value2json(json).encode('utf8')

            # ZIP
            zip = coalesce(zip, DEFAULTS['zip'])
            set_default(headers, {'Accept-Encoding': 'compress, gzip'})

            if zip:
                if is_sequence(data):
                    compressed = ibytes2icompressed(data)
                    headers['content-encoding'] = 'gzip'
                    data = compressed
                elif len(coalesce(data)) > 1000:
                    compressed = bytes2zip(data)
                    headers['content-encoding'] = 'gzip'
                    data = compressed
        except Exception as e:
            Log.error(u"Request setup failure on {{url}}", url=url, cause=e)

        errors = []
        for r in range(retry.times):
            if r:
                Till(seconds=retry.sleep).wait()

            try:
                request_count += 1
                with Timer(
                    "http {{method|upper}} to {{url}}",
                    param={"method": method, "url": text(url)},
                    verbose=DEBUG
                ):
                    return _session_request(session, url=str(url), headers=headers, data=data, json=None, kwargs=kwargs)
            except Exception as e:
                e = Except.wrap(e)
                if retry['http'] and str(url).startswith("https://") and "EOF occurred in violation of protocol" in e:
                    url = URL("http://" + str(url)[8:])
                    Log.note("Changed {{url}} to http due to SSL EOF violation.", url=str(url))
                errors.append(e)

        if " Read timed out." in errors[0]:
            Log.error(u"Tried {{times}} times: Timeout failure (timeout was {{timeout}}", timeout=timeout, times=retry.times, cause=errors[0])
        else:
            Log.error(u"Tried {{times}} times: Request failure of {{url}}", url=url, times=retry.times, cause=errors[0])


_session_request = override(sessions.Session.request)

if PY2:
    def _to_ascii_dict(headers):
        if headers is None:
            return
        for k, v in copy(headers).items():
            if is_text(k):
                del headers[k]
                if is_text(v):
                    headers[k.encode('ascii')] = v.encode('ascii')
                else:
                    headers[k.encode('ascii')] = v
            elif is_text(v):
                headers[k] = v.encode('ascii')
else:
    def _to_ascii_dict(headers):
        pass


def get(url, **kwargs):
    return HttpResponse(request('get', url, **kwargs))


def get_json(url, **kwargs):
    """
    ASSUME RESPONSE IN IN JSON
    """
    response = get(url, **kwargs)
    try:
        c = response.all_content
        path = URL(url).path
        if path.endswith(".zip"):
            buff = StringIO(c)
            archive = zipfile.ZipFile(buff, mode='r')
            c = archive.read(archive.namelist()[0])
        elif path.endswith(".gz"):
            c = zip2bytes(c)

        return json2value(c.decode('utf8'))
    except Exception as e:
        if mo_math.round(response.status_code, decimal=-2) in [400, 500]:
            Log.error(u"Bad GET response: {{code}}", code=response.status_code)
        else:
            Log.error(u"Good GET requests, but bad JSON", cause=e)


def options(url, **kwargs):
    return HttpResponse(request('options', url, **kwargs))


def head(url, **kwargs):
    return HttpResponse(request('head', url, **kwargs))


def post(url, **kwargs):
    return HttpResponse(request('post', url, **kwargs))


def post_json(url, **kwargs):
    """
    ASSUME RESPONSE IN IN JSON
    """
    if 'json' in kwargs:
        kwargs['data'] = value2json(kwargs['json']).encode('utf8')
        del kwargs['json']
    elif 'data' in kwargs:
        kwargs['data'] = value2json(kwargs['data']).encode('utf8')
    else:
        Log.error(u"Expecting `json` parameter")
    response = post(url, **kwargs)
    details = json2value(response.content.decode('utf8'))
    if response.status_code not in [200, 201, 202]:

        if "template" in details:
            Log.error(u"Bad response code {{code}}", code=response.status_code, cause=Except.wrap(details))
        else:
            Log.error(u"Bad response code {{code}}\n{{details}}", code=response.status_code, details=details)
    else:
        return details

def put(url, **kwargs):
    return HttpResponse(request('put', url, **kwargs))


def patch(url, **kwargs):
    return HttpResponse(request('patch', url, **kwargs))


def delete(url, **kwargs):
    kwargs.setdefault('stream', False)
    return HttpResponse(request('delete', url, **kwargs))


class HttpResponse(Response):
    def __new__(cls, resp):
        resp.__class__ = HttpResponse
        return resp

    def __init__(self, resp):
        pass
        self._cached_content = None

    @property
    def all_content(self):
        # response.content WILL LEAK MEMORY (?BECAUSE OF PYPY"S POOR HANDLING OF GENERATORS?)
        # THE TIGHT, SIMPLE, LOOP TO FILL blocks PREVENTS THAT LEAK
        if self._content is not False:
            self._cached_content = self._content
        elif self._cached_content is None:
            def read(size):
                if self.raw._fp.fp is not None:
                    return self.raw.read(amt=size, decode_content=True)
                else:
                    self.close()
                    return None

            self._cached_content = safe_size(Data(read=read))

        if hasattr(self._cached_content, "read"):
            self._cached_content.seek(0)

        return self._cached_content

    @property
    def all_lines(self):
        return self.get_all_lines()

    def get_all_lines(self, encoding='utf8', flexible=False):
        try:
            iterator = self.raw.stream(4096, decode_content=False)

            if self.headers.get('content-encoding') == 'gzip':
                return ibytes2ilines(icompressed2ibytes(iterator), encoding=encoding, flexible=flexible)
            elif self.headers.get('content-type') in [mimetype.ZIP, mimetype.GZIP]:
                return ibytes2ilines(icompressed2ibytes(iterator), encoding=encoding, flexible=flexible)
            elif self.url.endswith('.gz'):
                return ibytes2ilines(icompressed2ibytes(iterator), encoding=encoding, flexible=flexible)
            else:
                return ibytes2ilines(iterator, encoding=encoding, flexible=flexible, closer=self.close)
        except Exception as e:
            Log.error(u"Can not read content", cause=e)


class Generator_usingStream(object):
    """
    A BYTE GENERATOR USING A STREAM, AND BUFFERING IT FOR RE-PLAY
    """

    def __init__(self, stream, length, _shared=None):
        """
        :param stream:  THE STREAM WE WILL GET THE BYTES FROM
        :param length:  THE MAX NUMBER OF BYTES WE ARE EXPECTING
        :param _shared: FOR INTERNAL USE TO SHARE THE BUFFER
        :return:
        """
        self.position = 0
        file_ = TemporaryFile()
        if not _shared:
            self.shared = Data(
                length=length,
                locker=Lock(),
                stream=stream,
                done_read=0,
                file=file_,
                buffer=mmap(file_.fileno(), length)
            )
        else:
            self.shared = _shared

        self.shared.ref_count += 1

    def __iter__(self):
        return Generator_usingStream(None, self.shared.length, self.shared)

    def __enter__(self):
        return self

    def __exit__(self, type, value, traceback):
        self.close()

    def next(self):
        if self.position >= self.shared.length:
            raise StopIteration

        end = min(self.position + MIN_READ_SIZE, self.shared.length)
        s = self.shared
        with s.locker:
            while end > s.done_read:
                data = s.stream.read(MIN_READ_SIZE)
                s.buffer.write(data)
                s.done_read += MIN_READ_SIZE
                if s.done_read >= s.length:
                    s.done_read = s.length
                    s.stream.close()
        try:
            return s.buffer[self.position:end]
        finally:
            self.position = end

    def close(self):
        with self.shared.locker:
            if self.shared:
                s, self.shared = self.shared, None
                s.ref_count -= 1

                if s.ref_count==0:
                    try:
                        s.stream.close()
                    except Exception:
                        pass

                    try:
                        s.buffer.close()
                    except Exception:
                        pass

                    try:
                        s.file.close()
                    except Exception:
                        pass

    def __del__(self):
        self.close()

def countdown(vals):
    remaining = len(vals) - 1
    return [(remaining - i, v) for i, v in enumerate(vals)]

