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
