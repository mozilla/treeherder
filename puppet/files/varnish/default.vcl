/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

# We use Varnish even for development, since gunicorn/runserver default to 127.0.0.1:8000,
# and to be accessible from outside the VM we'd have to use 0.0.0.0. In addition, to serve
# on port 80 we'd have to run gunicorn/runserver with sudo or use authbind.
backend gunicorn {
    .host = "127.0.0.1";
    .port = "8000";
}

sub vcl_recv {
    set req.backend = gunicorn;
    return (pass);
}
