#!/usr/bin/env bash
# The latest versions of libmysqlclient 5.5/5.6 (used by mysqlclient) are still
# vulnerable to TLS stripping, even after last year's backports of 5.7.x fixes:
#   - https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2015-3152
#   - https://bugzilla.mozilla.org/show_bug.cgi?id=1289156
#   - http://bugs.mysql.com/bug.php?id=82383
#
# Ideally we'd just use the standalone Connector/C library instead of the
# libmysqlclient packages, however the latest release is too old:
#   - http://bugs.mysql.com/bug.php?id=82448
#
# Heroku's cedar-14 stack comes with libmysqlclient 5.5.x, so until it is updated
# to 5.7.x (https://github.com/heroku/stack-images/pull/38) we must manually vendor
# 5.7.X ourselves, so that connections between the Heroku dynos and our public RDS
# instances are secure. We can do this and still remain on MySQL server 5.6, since
# newer client releases are backwards compatible with older server versions.
#
# Whilst the Vagrant/Travis MySQL instances don't use TLS (and so aren't affected),
# we still want them to use libmysqlclient 5.7, to be consistent with production.
#
# Usage:
#    ./bin/vendor-libmysqlclient.sh "foo/vendor-dir"
#
# NB: The `foo/vendor-dir/bin` directory must be on the PATH ahead of `/usr/bin`
# during pip install (so mysqlclient finds `mysql_config`), and `LD_LIBRARY_PATH`
# must include `foo/vendor-dir/lib/x86_64-linux-gnu` at Python runtime.

# Make non-zero exit codes & other errors fatal.
set -euo pipefail

VENDOR_DIR="$1"
VERSION="5.7.14"
PACKAGE_URLS=(
    # We have to use packages from mysql.com since there is no Ubuntu distro
    # release available for MySQL 5.7 on Ubuntu 14.04.
    "https://cdn.mysql.com/Downloads/MySQL-5.7/libmysqlclient20_${VERSION}-1ubuntu14.04_amd64.deb"
    "https://cdn.mysql.com/Downloads/MySQL-5.7/libmysqlclient-dev_${VERSION}-1ubuntu14.04_amd64.deb"
)

# Skip vendoring if libmysqlclient-dev's `mysql_config` exists and reports the correct version.
if [[ "$(mysql_config --version 2>&1)" == "$VERSION" ]]; then
    exit 0
fi

echo "-----> Vendoring libmysqlclient $VERSION."

# We manually extract the packages rather than using apt-get install, since:
#  - On Heroku we don't have sudo, so need to vendor the package somewhere other
#    than the standard `/usr/{bin,lib,include}` locations.
#  - For Vagrant/Travis we have to install mysql-server-5.6 (we have to test against
#    against the same server version as used in production) and there are unresolvable
#    packaging conflicts between it and libmysqlclient 5.7, if installed with apt-get.
#  - The compiled binary releases of libmysqlclient aren't available as a tar archive.
for url in "${PACKAGE_URLS[@]}"; do
    # Use `dpkg-deb`'s filesystem tarfile mode along with `tar`, rather than just
    # `dpkg --extract`, since the latter doesn't support removing the `/./usr/`
    # directory prefix itself, and so would require error-prone directory shuffling
    # afterwards. The `share` directory and static library files are not used, so are
    # excluded to reduce the slug/cache size (and thus transfer times) on Heroku/Travis.
    curl -sS "$url" \
      | dpkg-deb --fsys-tarfile /dev/stdin \
      | tar -x --strip-components=2 --exclude="./usr/share" --exclude="*.a" -C "$VENDOR_DIR"
done

if (which pip && pip show mysqlclient) > /dev/null; then
    # The mysqlclient Python package won't pick up the new version of libmysqlclient
    # unless it's recompiled against it. However unless we purge the old package, pip
    # won't know to reinstall, since the version of mysqlclient itself hasn't changed.
    echo "-----> Uninstalling mysqlclient to force recompilation during pip install."
    pip uninstall -yq mysqlclient
fi
