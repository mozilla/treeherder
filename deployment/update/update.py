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


@task
def update_code(ctx, tag):
    """Update the code to a specific git reference (tag/sha/etc)."""
    with ctx.lcd(th_service_src):
        ctx.local('git checkout %s' % tag)
        ctx.local('git pull -f')
        ctx.local('git submodule sync')
        ctx.local('git submodule update --init --recursive')
        ctx.local("find . -type f -name '*.pyc' -delete")

    with ctx.lcd(th_ui_src):
        ctx.local('git checkout %s' % tag)
        ctx.local('git pull -f')
        ctx.local('git submodule sync')
        ctx.local('git submodule update --init --recursive')
        ctx.local("find . -type f -name '*.pyc' -delete")


def update_assets(ctx):

    cwd = os.getcwd()

    # change cwd to ui src directory
    ctx.local( "cd {0}".format(th_ui_src) )

    # run grunt in ui src directory
    ctx.local( "{0}/grunt build".format(settings.BIN_DIR) )

    # change cwd back to original location
    ctx.local( "cd {0}".format(cwd) )


def update_oauth_credentials(ctx):
    ctx.local("python2.6 manage.py export_project_credentials")


@task
def update_db(ctx):
    """Update the database schema, if necessary."""

    with ctx.lcd(th_service_src):
        ctx.local('python2.6 manage.py syncdb')
        ctx.local('python2.6 manage.py migrate')


@task
def checkin_changes(ctx):
    """Use the local, IT-written deploy script to check in changes."""
    ctx.local(settings.DEPLOY_SCRIPT)


@hostgroups(
    settings.WEB_HOSTGROUP, remote_kwargs={'ssh_key': settings.SSH_KEY})
def deploy_web_app(ctx):
    """Call the remote update script to push changes to webheads."""
    ctx.remote(settings.REMOTE_UPDATE_SCRIPT)

    # Make sure web assets are rebuilt when code is updated
    update_assets(ctx)

    # this is primarely for the persona ui
    ctx.remote("python2.6 manage.py collectstatic --noinput")

    ctx.remote( '{0}/service httpd graceful'.format(settings.SBIN_DIR) )
    ctx.remote( '{0}/supervisorctl restart gunicorn'.format(settings.BIN_DIR) )


@hostgroups(
    settings.CELERY_HOSTGROUP, remote_kwargs={'ssh_key': settings.SSH_KEY})
def deploy_workers(ctx):
    """Call the remote update script to push changes to workers."""
    ctx.remote(settings.REMOTE_UPDATE_SCRIPT)

    # Restarts celery worker on the celery hostgroup to listen to the
    # celery queues: log_parser_fail,log_parser
    ctx.remote(
        '{0}/supervisorctl restart celery_gevent'.format(settings.BIN_DIR))


def deploy_admin_node(ctx):

    # Restarts celery worker on the admin node listening to the
    # celery queues: default
    ctx.remote(
        '{0}/supervisorctl restart run_celery_worker'.format(settings.BIN_DIR))


@task
def update_info(ctx):
    """Write info about the current state to a publicly visible file."""
    with ctx.lcd(th_service_src):
        ctx.local('date')
        ctx.local('git branch')
        ctx.local('git log -3')
        ctx.local('git status')
        ctx.local('git submodule status')

        ctx.local('git rev-parse HEAD > webapp/media/revision')


@task
def pre_update(ctx, ref=settings.UPDATE_REF):
    """Update code to pick up changes to this file."""
    update_code(ref)


@task
def update(ctx):
    update_assets(ctx)
    update_db(ctx)
    update_oauth_credentials(ctx)


@task
def deploy(ctx):
    checkin_changes()
    deploy_web_app()
    deploy_workers()
    deploy_admin_node()
    update_info()
