backend apache {
    .host = "127.0.0.1";
    .port = "8080";
}
backend socketio {
    .host = "127.0.0.1";
    .port = "8005";
}
sub vcl_pipe {
    if (req.http.upgrade) {
        set bereq.http.upgrade = req.http.upgrade;
    }
}
sub vcl_recv {
    if (req.url ~ "socket.io/[0-9]") {
        set req.backend = socketio;
        return (pipe);
    }
    else {
        set req.backend = apache;
    }
}

sub vcl_fetch {
    if (beresp.http.content-type ~ "json" || beresp.http.content-type ~ "text" ) {
        set beresp.do_gzip = true;
    }
}
