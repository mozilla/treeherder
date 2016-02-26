"""
Deploy this project in stage/production.

Requires commander_ which is installed on the systems that need it.

.. _commander: https://github.com/oremj/commander
"""

import os
import requests
import sys

from commander.deploy import hostgroups, task

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import commander_settings as settings  # noqa

env_file = os.path.join(settings.SRC_DIR, 'treeherder-env.sh')
th_service_src = os.path.join(settings.SRC_DIR, 'treeherder-service')

is_prod = 'treeherder.mozilla.org' in settings.SRC_DIR


def run_local_with_env(ctx, cmd):
    # For commands run from the admin node, we have to manually set the environment
    # variables, since the admin node is shared by both stage and prod.
    ctx.local("source {} && {}".format(env_file, cmd))


@task
def pre_update(ctx, ref=settings.UPDATE_REF):
    # Update the code to a specific git reference (branch/tag/sha) and write
    # info about the current repository state to a publicly visible file.
    with ctx.lcd(th_service_src):
        ctx.local('git fetch --quiet origin %s' % ref)
        ctx.local('git reset --hard FETCH_HEAD')
        ctx.local('find . -type f -name "*.pyc" -delete')
        ctx.local('git status -s')


@task
def update(ctx):
    # Create/populate a virtualenv that will be rsynced later along with the source.
    with ctx.lcd(settings.SRC_DIR):
        activate_script = os.path.join(settings.SRC_DIR, 'venv', 'bin', 'activate_this.py')
        # We reuse the virtualenv to speed up deploys.
        if not os.path.exists(activate_script):
            ctx.local('virtualenv --python=python2.7 venv')
        # Activate virtualenv.
        execfile(activate_script, dict(__file__=activate_script))
        # Install requirements using pip v8's new hash-checking mode.
        with ctx.lcd(th_service_src):
            ctx.local('pip2.7 install --require-hashes -r requirements/common.txt')
        # Make the virtualenv relocatable since paths are hard-coded by default.
        ctx.local('virtualenv --relocatable venv')
        # Fix lib64 symlink to be relative instead of absolute.
        with ctx.lcd('venv'):
            ctx.local('rm -f lib64')
            ctx.local('ln -s lib lib64')

    with ctx.lcd(th_service_src):
        # Install nodejs non-dev packages, needed for the grunt build.
        ctx.local("npm install --production")
        # Generate the UI assets in the `dist/` directory.
        ctx.local("./node_modules/.bin/grunt build --production")
        # Make the current Git revision accessible at <site-root>/revision.txt
        ctx.local("git rev-parse HEAD > dist/revision.txt")
        # Generate gzipped versions of files that would benefit from compression, that
        # WhiteNoise can then serve in preference to the originals. This is required
        # since WhiteNoise's Django storage backend only gzips assets handled by
        # collectstatic, and so does not affect files in the `dist/` directory.
        ctx.local("python2.7 -m whitenoise.gzip dist")
        # Collect the static files (eg for the Persona or Django admin UI)
        run_local_with_env(ctx, "python2.7 manage.py collectstatic --noinput")
        # Update the database schema, if necessary.
        run_local_with_env(ctx, "python2.7 manage.py migrate --noinput")
        # Update reference data & tasks config from the in-repo fixtures.
        run_local_with_env(ctx, "python2.7 manage.py load_initial_data")
        # Populate the datasource table and create the connected databases.
        run_local_with_env(ctx, "python2.7 manage.py init_datasources")


@task
def deploy(ctx):
    # Use the local, IT-written deploy script to check in changes.
    ctx.local(settings.DEPLOY_SCRIPT)
    # Rsync the updated code to the nodes & restart processes. These are
    # separated out into their own functions, since the IRC bot output includes
    # the task function name which is useful given how long these steps take.
    deploy_rabbit()
    deploy_web_app()
    deploy_etl()
    deploy_log()
    ping_newrelic()


@task
def deploy_rabbit(ctx):
    deploy_nodes(ctx, settings.RABBIT_HOSTGROUP, 'rabbit')


@task
def deploy_web_app(ctx):
    deploy_nodes(ctx, settings.WEB_HOSTGROUP, 'web')


@task
def deploy_etl(ctx):
    deploy_nodes(ctx, settings.ETL_HOSTGROUP, 'etl')


@task
def deploy_log(ctx):
    deploy_nodes(ctx, settings.LOG_HOSTGROUP, 'log')


def deploy_nodes(ctx, hostgroup, node_type):
    # Run the remote update script on each node in the specified hostgroup.
    @hostgroups(hostgroup, remote_kwargs={'ssh_key': settings.SSH_KEY})
    def rsync_code(ctx):
        ctx.remote(settings.REMOTE_UPDATE_SCRIPT)

    rsync_code()
    env_flag = '-p' if is_prod else '-s'
    ctx.local('/root/bin/restart-jobs %s %s' % (env_flag, node_type))


@task
def ping_newrelic(ctx):
    data = {
        'deployment[application_id]': settings.NEW_RELIC_APP_ID,
        'deployment[user]': 'Chief',
    }
    headers = {'x-api-key': settings.NEW_RELIC_API_KEY}
    r = requests.post('https://api.newrelic.com/deployments.xml',
                      data=data, headers=headers, timeout=30)
    try:
        r.raise_for_status()
    except requests.exceptions.HTTPError:
        print("HTTPError {} notifying New Relic: {}".format(r.status_code, r.text))
        raise
