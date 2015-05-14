/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

backend apache {
    .host = "127.0.0.1";
    .port = "8080";
}
sub vcl_pipe {
    if (req.http.upgrade) {
        set bereq.http.upgrade = req.http.upgrade;
    }
}
sub vcl_recv {
    set req.backend = apache;
    return (pass);
}

sub vcl_fetch {
    if (beresp.http.content-type ~ "json" || beresp.http.content-type ~ "text" ) {
        set beresp.do_gzip = true;
    }
}
