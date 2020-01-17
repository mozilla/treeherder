# encoding: utf-8
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
#
# Contact: Kyle Lahnakoski (kyle@lahnakoski.com)
#
from __future__ import absolute_import, division, unicode_literals

from functools import update_wrapper
from ssl import PROTOCOL_SSLv23, SSLContext

import flask
from flask import Response

from mo_dots import coalesce, is_data
from mo_files import File, TempFile, URL, mimetype
from mo_future import decorate, text
from mo_json import value2json
from mo_logs import Log
from mo_threads.threads import register_thread, Thread
from pyLibrary.env import git
from pyLibrary.env.big_data import ibytes2icompressed

TOO_SMALL_TO_COMPRESS = 510  # DO NOT COMPRESS DATA WITH LESS THAN THIS NUMBER OF BYTES


def gzip_wrapper(func, compress_lower_limit=None):
    compress_lower_limit = coalesce(compress_lower_limit, TOO_SMALL_TO_COMPRESS)

    def output(*args, **kwargs):
        response = func(*args, **kwargs)
        accept_encoding = flask.request.headers.get("Accept-Encoding", "")
        if "gzip" not in accept_encoding.lower():
            return response

        response.headers["Content-Encoding"] = "gzip"
        response.response = ibytes2icompressed(response.response)

        return response

    return output


def cors_wrapper(func):
    """
    Decorator for CORS
    :param func:  Flask method that handles requests and returns a response
    :return: Same, but with permissive CORS headers set
    """

    def _setdefault(obj, key, value):
        if value == None:
            return
        obj.setdefault(key, value)

    @decorate(func)
    def output(*args, **kwargs):
        response = func(*args, **kwargs)
        headers = response.headers

        # WATCH OUT FOR THE RUBE GOLDBERG LOGIC!
        # https://fetch.spec.whatwg.org/#cors-protocol-and-credentials

        origin = URL(flask.request.headers.get("Origin"))
        if origin.host:
            allow_origin = str(origin)
            # allow_origin = origin.scheme + "://" + origin.host
        else:
            allow_origin = "*"
        _setdefault(headers, "Access-Control-Allow-Origin", allow_origin)
        _setdefault(headers, "Access-Control-Allow-Credentials", "true")
        _setdefault(
            headers,
            "Access-Control-Allow-Headers",
            flask.request.headers.get("Access-Control-Request-Headers"),
        )
        _setdefault(
            headers,
            "Access-Control-Allow-Methods",                              # PLURAL "Methods"
            flask.request.headers.get("Access-Control-Request-Method"),  # SINGULAR "Method"
            # "GET, PUT, POST, DELETE, PATCH, OPTIONS"
        )
        _setdefault(headers, "Content-Type", mimetype.JSON)
        _setdefault(
            headers,
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains; preload",
        )
        return response

    output.provide_automatic_options = False
    return update_wrapper(output, func)


def dockerflow(flask_app, backend_check):
    """
    ADD ROUTING TO HANDLE DOCKERFLOW APP REQUIREMENTS
    (see https://github.com/mozilla-services/Dockerflow#containerized-app-requirements)
    :param flask_app: THE (Flask) APP
    :param backend_check: METHOD THAT WILL CHECK THE BACKEND IS WORKING AND RAISE AN EXCEPTION IF NOT
    :return:
    """
    global VERSION_JSON

    try:
        VERSION_JSON = File("version.json").read_bytes()

        @cors_wrapper
        def version():
            return Response(
                VERSION_JSON, status=200, headers={"Content-Type": mimetype.JSON}
            )

        @cors_wrapper
        def heartbeat():
            try:
                backend_check()
                return Response(status=200)
            except Exception as e:
                Log.warning("heartbeat failure", cause=e)
                return Response(
                    value2json(e).encode('utf8'),
                    status=500,
                    headers={"Content-Type": mimetype.JSON},
                )

        @cors_wrapper
        def lbheartbeat():
            return Response(status=200)

        flask_app.add_url_rule(
            str("/__version__"),
            None,
            version,
            defaults={},
            methods=[str("GET"), str("POST")],
        )
        flask_app.add_url_rule(
            str("/__heartbeat__"),
            None,
            heartbeat,
            defaults={},
            methods=[str("GET"), str("POST")],
        )
        flask_app.add_url_rule(
            str("/__lbheartbeat__"),
            None,
            lbheartbeat,
            defaults={},
            methods=[str("GET"), str("POST")],
        )
    except Exception as e:
        Log.error("Problem setting up listeners for dockerflow", cause=e)


VERSION_JSON = None


def add_version(flask_app):
    """
    ADD ROUTING TO HANDLE REQUEST FOR /__version__
    :param flask_app: THE (Flask) APP
    :return:
    """
    try:
        rev = coalesce(git.get_revision(), "")
        branch = "https://github.com/mozilla/ActiveData/tree/" + coalesce(git.get_branch())

        version_info = value2json(
            {
                "source": "https://github.com/mozilla/ActiveData/tree/" + rev,
                "branch": branch,
                "commit": rev,
            },
            pretty=True,
        ).encode('utf8') + text("\n")

        Log.note("Using github version\n{{version}}", version=version_info)

        @register_thread
        @cors_wrapper
        def version():
            return Response(
                version_info, status=200, headers={"Content-Type": mimetype.JSON}
            )

        flask_app.add_url_rule(
            str("/__version__"),
            None,
            version,
            defaults={},
            methods=[str("GET"), str("POST")],
        )
    except Exception as e:
        Log.error("Problem setting up listeners for dockerflow", cause=e)


def setup_flask_ssl(flask_app, flask_config):
    """
    SPAWN A NEW THREAD TO RUN AN SSL ENDPOINT
    REMOVES ssl_context FROM flask_config BEFORE RETURNING

    :param flask_app:
    :param flask_config:
    :return:
    """
    if not flask_config.ssl_context:
        return

    ssl_flask = flask_config.copy()
    ssl_flask.debug = False
    ssl_flask.port = 443

    if is_data(flask_config.ssl_context):
        # EXPECTED PEM ENCODED FILE NAMES
        # `load_cert_chain` REQUIRES CONCATENATED LIST OF CERTS
        with TempFile() as tempfile:
            try:
                tempfile.write(
                    File(ssl_flask.ssl_context.certificate_file).read_bytes()
                )
                if ssl_flask.ssl_context.certificate_chain_file:
                    tempfile.write(
                        File(ssl_flask.ssl_context.certificate_chain_file).read_bytes()
                    )
                tempfile.flush()
                tempfile.close()

                context = SSLContext(PROTOCOL_SSLv23)
                context.load_cert_chain(
                    tempfile.name,
                    keyfile=File(ssl_flask.ssl_context.privatekey_file).abspath,
                )

                ssl_flask.ssl_context = context
            except Exception as e:
                Log.error("Could not handle ssl context construction", cause=e)

    def runner(please_stop):
        Log.warning(
            "ActiveData listening on encrypted port {{port}}", port=ssl_flask.port
        )
        flask_app.run(**ssl_flask)

    Thread.run("SSL Server", runner)

    if flask_config.ssl_context and flask_config.port != 80:
        Log.warning(
            "ActiveData has SSL context, but is still listening on non-encrypted http port {{port}}",
            port=flask_config.port,
        )

    flask_config.ssl_context = None


def limit_body(size):
    def decorator(func):
        @decorate(func)
        def output(*args, **kwargs):
            if flask.request.headers.get("content-length", "") in ["", "0"]:
                Log.error("Expecting Content-Length in request headers")
            elif int(flask.request.headers["content-length"]) > size:
                Log.error("Body is limited to {{size}} bytes", size=size)
            return func(*args, **kwargs)
        return output
    return decorator


@register_thread
@cors_wrapper
def options(*args, **kwargs):
    """
    USE THIS FOR THE OPTIONS AND HEAD REQUEST TYPES
    """
    return Response("", status=200)


def add_flask_rule(flask_app, path, func):
    flask_app.add_url_rule(
        "/" + path.strip("/"),
        None,
        options,
        methods=["OPTIONS", "HEAD"],
        )
    flask_app.add_url_rule(
        "/" + path.strip("/") + "/",
        None,
        options,
        methods=["OPTIONS", "HEAD"],
        )

    flask_app.add_url_rule(
        "/" + path.strip("/"),
        None,
        func,
        methods=["GET", "POST"],
        provide_automatic_options=False
        )
    flask_app.add_url_rule(
        "/" + path.strip("/") + "/",
        None,
        func,
        methods=["GET", "POST"],
        provide_automatic_options=False
        )

