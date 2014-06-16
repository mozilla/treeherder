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

th_settings = 'treeherder.settings'

sys.path.append(th_service_src)


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


def update_oauth_credentials(ctx):

    with ctx.lcd(th_service_src):
        ctx.local(
            "python2.6 manage.py export_project_credentials --settings {0}".format(th_settings))


def update_db(ctx):
    """Update the database schema, if necessary."""

    with ctx.lcd(th_service_src):
        ctx.local('python2.6 manage.py syncdb --settings {0}'.format(th_settings))
        ctx.local('python2.6 manage.py migrate --settings {0}'.format(th_settings))

def checkin_changes(ctx):
    """Use the local, IT-written deploy script to check in changes."""
    ctx.local(settings.DEPLOY_SCRIPT)


@hostgroups(
    settings.WEB_HOSTGROUP, remote_kwargs={'ssh_key': settings.SSH_KEY})
def deploy_web_app(ctx):
    """Call the remote update script to push changes to webheads."""
    ctx.remote(settings.REMOTE_UPDATE_SCRIPT)
    ctx.remote( '{0}/service httpd graceful'.format(settings.SBIN_DIR) )
    ctx.remote( '{0}/service gunicorn restart'.format(settings.SBIN_DIR) )


@hostgroups(
    settings.CELERY_HOSTGROUP, remote_kwargs={'ssh_key': settings.SSH_KEY})
def deploy_workers(ctx):
    """Call the remote update script to push changes to workers."""
    ctx.remote(settings.REMOTE_UPDATE_SCRIPT)

    # Restarts celery worker on the celery hostgroup to listen to the
    # celery queues: log_parser_fail,log_parser
    ctx.remote(
        '{0}/service celery-worker-gevent restart'.format(settings.SBIN_DIR))


def deploy_admin_node(ctx):

    ctx.local(
        '{0}/service celerybeat restart'.format(settings.SBIN_DIR))

    # Restarts celery worker on the admin node listening to the
    # celery queues: default
    ctx.local(
        '{0}/service celery restart'.format(settings.SBIN_DIR))

    with ctx.lcd(th_service_src):
        # this is primarely for the persona ui
        ctx.local("python2.6 manage.py collectstatic --noinput --settings {0}".format(th_settings))
        ctx.local("python2.6 setup.py build_ext --inplace")


def update_info(ctx):
    """Write info about the current state to a publicly visible file."""
    with ctx.lcd(th_service_src):
        ctx.local('date')
        ctx.local('git branch')
        ctx.local('git log -3')
        ctx.local('git status')
        ctx.local('git submodule status')

        ctx.local('git rev-parse HEAD > treeherder/webapp/media/revision')


@task
def pre_update(ctx, ref=settings.UPDATE_REF):
    """Update code to pick up changes to this file."""
    update_code(ctx, ref)


@task
def update(ctx):
    update_db(ctx)
    update_oauth_credentials(ctx)


@task
def deploy(ctx):
    checkin_changes(ctx)
    deploy_web_app()
    deploy_workers()
    deploy_admin_node(ctx)
    update_info(ctx)
