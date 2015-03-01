# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

"""
Deploy this project in dev/stage/production.

Requires commander_ which is installed on the systems that need it.

.. _commander: https://github.com/oremj/commander
"""

import os

from commander.deploy import task, hostgroups
import commander_settings as settings

th_service_src = os.path.join(settings.SRC_DIR, 'treeherder-service')
th_ui_src = os.path.join(settings.SRC_DIR, 'treeherder-ui')

is_prod = 'treeherder.mozilla.org' in settings.SRC_DIR
env_flag = '-p' if is_prod else '-s'


@task
def pre_update(ctx, ref=settings.UPDATE_REF):
    # Update the code to a specific git reference (branch/tag/sha) and write
    # info about the current repository state to a publicly visible file.
    with ctx.lcd(th_service_src):
        ctx.local('git fetch --quiet origin %s' % ref)
        ctx.local('git reset --hard FETCH_HEAD')
        ctx.local("find . -type f -name '*.pyc' -delete")
        ctx.local('date')
        ctx.local('git branch')
        ctx.local('git log -3')
        ctx.local('git status')
        ctx.local('git rev-parse HEAD > treeherder/webapp/media/revision')

    with ctx.lcd(th_ui_src):
        ctx.local('git fetch --quiet origin %s' % ref)
        ctx.local('git reset --hard FETCH_HEAD')
        ctx.local("find . -type f -name '*.pyc' -delete")
        ctx.local('date')
        ctx.local('git branch')
        ctx.local('git log -3')
        ctx.local('git status')
        ctx.local('git rev-parse HEAD >> ../treeherder-service/treeherder/webapp/media/revision')


@task
def update(ctx):
    with ctx.lcd(th_service_src):
        # Collect the static files (eg for the Persona or Django admin UI)
        ctx.local("python2.7 manage.py collectstatic --noinput")

        # Rebuild the Cython code (eg the log parser)
        ctx.local("python2.7 setup.py build_ext --inplace")

        # Update the database schema, if necessary.
        ctx.local("python2.7 manage.py migrate")

        # Update reference data & tasks config from the in-repo fixtures.
        ctx.local("python2.7 manage.py load_initial_data")

        # Populate the datasource table and create the connected databases.
        ctx.local("python2.7 manage.py init_datasources")

        # Update oauth credentials.
        ctx.local("python2.7 manage.py export_project_credentials")

        # Clear the cache.
        ctx.local("python2.7 manage.py clear_cache")


@task
def deploy(ctx):
    # Use the local, IT-written deploy script to check in changes.
    ctx.local(settings.DEPLOY_SCRIPT)

    def restart_jobs(ctx, type):
        ctx.local('/root/bin/restart-jobs %s %s' % (env_flag, type))

    # Restart celerybeat on the admin node.
    @hostgroups(settings.RABBIT_HOSTGROUP, remote_kwargs={'ssh_key': settings.SSH_KEY})
    def deploy_rabbit(ctx):
        ctx.remote(settings.REMOTE_UPDATE_SCRIPT)

    deploy_rabbit()
    restart_jobs(ctx, 'rabbit')

    @hostgroups(settings.WEB_HOSTGROUP, remote_kwargs={'ssh_key': settings.SSH_KEY})
    def deploy_web_app(ctx):
        # Call the remote update script to push changes to webheads.
        ctx.remote(settings.REMOTE_UPDATE_SCRIPT)
        ctx.remote('{0}/service httpd graceful'.format(settings.SBIN_DIR))

    deploy_web_app()
    restart_jobs(ctx, 'web')

    @hostgroups(settings.ETL_HOSTGROUP, remote_kwargs={'ssh_key': settings.SSH_KEY})
    def deploy_etl(ctx):
        # Call the remote update script to push changes to workers.
        ctx.remote(settings.REMOTE_UPDATE_SCRIPT)

    deploy_etl()
    restart_jobs(ctx, 'etl')

    @hostgroups(settings.LOG_HOSTGROUP, remote_kwargs={'ssh_key': settings.SSH_KEY})
    def deploy_log(ctx):
        # Call the remote update script to push changes to workers.
        ctx.remote(settings.REMOTE_UPDATE_SCRIPT)

    deploy_log()
    restart_jobs(ctx, 'log')
