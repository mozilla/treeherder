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


def rebuild(ctx):
    with ctx.lcd(th_service_src):
        # Collect the static files (eg for the Persona or Django admin UI)
        ctx.local("python2.6 manage.py collectstatic --noinput --settings {0}".format(th_settings))
        # Rebuild the Cython code (eg the log parser)
        ctx.local("python2.6 setup.py build_ext --inplace")


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


def deploy_admin_node(ctx):
    # Restart celerybeat
    ctx.local(
        '{0}/service celerybeat restart'.format(settings.SBIN_DIR))


@hostgroups(
    settings.WEB_HOSTGROUP, remote_kwargs={'ssh_key': settings.SSH_KEY})
def deploy_web_app(ctx):
    """Call the remote update script to push changes to webheads."""
    ctx.remote(settings.REMOTE_UPDATE_SCRIPT)
    ctx.remote('{0}/service httpd graceful'.format(settings.SBIN_DIR))
    ctx.remote('{0}/service gunicorn restart'.format(settings.SBIN_DIR))
    ctx.remote('{0}/service socketio-server restart'.format(settings.SBIN_DIR))


@hostgroups(
    settings.CELERY_HOSTGROUP, remote_kwargs={'ssh_key': settings.SSH_KEY})
def deploy_workers(ctx):
    """Call the remote update script to push changes to workers."""
    ctx.remote(settings.REMOTE_UPDATE_SCRIPT)


def restart_celery_workers(ctx):
    """Send a warm shutdown event to all the workers in the cluster.
The workers will finish their current tasks and safely shutdown.
Supervisord will then start new workers to replace them.
We need to do this because supervisorctl generates zombies
every time you ask it to restart a worker.
"""
    with ctx.lcd(th_service_src):
        ctx.local("python2.6 manage.py shutdown_workers --settings {0}".format(th_settings))


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
def update(ctx):
    rebuild(ctx)
    update_db(ctx)
    update_oauth_credentials(ctx)


@task
def deploy(ctx):
    checkin_changes(ctx)
    deploy_admin_node(ctx)
    deploy_web_app()
    deploy_workers()
    restart_celery_workers(ctx)
    update_info(ctx)
