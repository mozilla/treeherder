from _mysql import get_client_info
from django.core.checks import (Error,
                                Tags,
                                register)


def version_to_tuple(version):
    """Converts a version string like `"5.7.0"` into the tuple `(5, 7, 0)`."""
    return tuple(int(v) for v in version.split('.'))


@register(Tags.security)
def check_libmysqlclient_version(app_configs, **kwargs):
    """
    Check mysqlclient has been compiled against a version of libmysqlclient
    that isn't vulnerable to TLS stripping. See vendor-libmysqclient.sh.
    """
    # get_client_info() returns the libmysqlclient version as a string of form `5.7.0`.
    libmysqlclient_version = get_client_info()
    if version_to_tuple(libmysqlclient_version) < (5, 7, 11):
        msg = ("mysqlclient has been compiled against an insecure version "
               "of libmysqlclient (%s)." % libmysqlclient_version)
        hint = "If using Vagrant, run `vagrant provision` and re-login."
        return [Error(msg, hint=hint, id="treeherder.E001")]
    return []
