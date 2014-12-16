# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

"""
Deploy this project in dev/stage/production.

Requires commander_ which is installed on the systems that need it.

.. _commander: https://github.com/oremj/commander
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from commander.deploy import task, hostgroups
import commander_settings as settings

th_service_src = os.path.join(settings.SRC_DIR, 'treeherder-service')
th_ui_src = os.path.join(settings.SRC_DIR, 'treeherder-ui')

sys.path.append(th_service_src)


@task
def pre_update(ctx, ref=settings.UPDATE_REF):
    """Update the code to a specific git reference (tag/sha/etc)."""
    with ctx.lcd(th_service_src):
        ctx.local('git checkout %s' % ref)
        ctx.local('git pull -f')
        ctx.local('git submodule sync')
        ctx.local('git submodule update --init --recursive')
        ctx.local("find . -type f -name '*.pyc' -delete")

    with ctx.lcd(th_ui_src):
        ctx.local('git checkout %s' % ref)
        ctx.local('git pull -f')
        ctx.local('git submodule sync')
        ctx.local('git submodule update --init --recursive')
        ctx.local("find . -type f -name '*.pyc' -delete")


@task
def update(ctx):
    with ctx.lcd(th_service_src):
        # Collect the static files (eg for the Persona or Django admin UI)
        ctx.local("python2.6 manage.py collectstatic --noinput")

        # Rebuild the Cython code (eg the log parser)
        ctx.local("python2.6 setup.py build_ext --inplace")

        # Update the database schema, if necessary.
        ctx.local("python2.6 manage.py syncdb")
        ctx.local("python2.6 manage.py migrate")

        # Update reference data & tasks config from the in-repo fixtures.
        ctx.local("python2.6 manage.py load_initial_data")

        # Populate the datasource table and create the connected databases.
        ctx.local("python2.6 manage.py init_datasources")

        # Update oauth credentials.
        ctx.local("python2.6 manage.py export_project_credentials")

        # Clear the cache.
        ctx.local("python2.6 manage.py clear_cache")


@task
def deploy(ctx):
    # Use the local, IT-written deploy script to check in changes.
    ctx.local(settings.DEPLOY_SCRIPT)

    # Restart celerybeat on the admin node.
    @hostgroups(settings.RABBIT_HOSTGROUP, remote_kwargs={'ssh_key': settings.SSH_KEY})
    def deploy_rabbit(ctx):
        ctx.remote(settings.REMOTE_UPDATE_SCRIPT)
        ctx.remote('{0}/service run_celerybeat restart'.format(settings.SBIN_DIR))
        ctx.remote('{0}/service run_celery_worker restart'.format(settings.SBIN_DIR))
        ctx.remote('{0}/service run_celery_worker_hp restart'.format(settings.SBIN_DIR))

    deploy_rabbit()

    @hostgroups(settings.WEB_HOSTGROUP, remote_kwargs={'ssh_key': settings.SSH_KEY})
    def deploy_web_app(ctx):
        # Call the remote update script to push changes to webheads.
        ctx.remote(settings.REMOTE_UPDATE_SCRIPT)
        ctx.remote('{0}/service httpd graceful'.format(settings.SBIN_DIR))
        ctx.remote('{0}/service run_gunicorn restart'.format(settings.SBIN_DIR))

    deploy_web_app()

    @hostgroups(settings.ETL_HOSTGROUP, remote_kwargs={'ssh_key': settings.SSH_KEY})
    def deploy_etl(ctx):
        # Call the remote update script to push changes to workers.
        ctx.remote(settings.REMOTE_UPDATE_SCRIPT)
        ctx.remote('{0}/service run_celery_worker_buildapi restart'.format(settings.SBIN_DIR))
        ctx.remote('{0}/service run_celery_worker_pushlog restart'.format(settings.SBIN_DIR))

    deploy_etl()

    @hostgroups(settings.LOG_HOSTGROUP, remote_kwargs={'ssh_key': settings.SSH_KEY})
    def deploy_log(ctx):
        # Call the remote update script to push changes to workers.
        ctx.remote(settings.REMOTE_UPDATE_SCRIPT)
        ctx.remote('{0}/service run_celery_worker_gevent restart'.format(settings.SBIN_DIR))

    deploy_log()

    with ctx.lcd(th_service_src):
        # Write info about the current repository state to a publicly visible file.
        ctx.local('date')
        ctx.local('git branch')
        ctx.local('git log -3')
        ctx.local('git status')
        ctx.local('git submodule status')
        ctx.local('git rev-parse HEAD > treeherder/webapp/media/revision')

    with ctx.lcd(th_ui_src):
        # Write info about the current repository state to a publicly visible file.
        ctx.local('date')
        ctx.local('git branch')
        ctx.local('git log -3')
        ctx.local('git status')
        ctx.local('git submodule status')
        ctx.local('git rev-parse HEAD > treeherder/webapp/media/revision')
