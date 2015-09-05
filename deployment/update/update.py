"""
Deploy this project in stage/production.

Requires commander_ which is installed on the systems that need it.

.. _commander: https://github.com/oremj/commander
"""

import os
import sys
import urllib
import urllib2

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
        # Remove gzipped UI assets in case the uncompressed original no longer exists.
        ctx.local('find dist/ -type f -name "*.gz" -delete')
        ctx.local('git status -s')
        # Make the current Git revision accessible at <site-root>/revision.txt
        ctx.local('git rev-parse HEAD > dist/revision.txt')


@task
def update(ctx):
    # Create/populate a virtualenv that will be rsynced later along with the source.
    with ctx.lcd(settings.SRC_DIR):
        activate_script = os.path.join(settings.SRC_DIR, 'venv', 'bin', 'activate_this.py')
        # Peep doesn't yet cache downloaded files, so we reuse the virtualenv to speed up deploys.
        if not os.path.exists(activate_script):
            ctx.local('virtualenv --python=python2.7 venv')
        # Activate virtualenv.
        execfile(activate_script, dict(__file__=activate_script))
        # Install requirements using peep, so hashes are verified.
        with ctx.lcd(th_service_src):
            ctx.local('python2.7 bin/peep.py install -r requirements/common.txt')
        # Make the virtualenv relocatable since paths are hard-coded by default.
        ctx.local('virtualenv --relocatable venv')
        # Fix lib64 symlink to be relative instead of absolute.
        with ctx.lcd('venv'):
            ctx.local('rm -f lib64')
            ctx.local('ln -s lib lib64')

    with ctx.lcd(th_service_src):
        # Once we no longer use credentials.json, everything below apart from
        # collectstatic should be performed on one of the stage/prod specific
        # nodes at the end of the deploy, rather than on the admin node.

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
        # Update oauth credentials.
        run_local_with_env(ctx, "python2.7 manage.py export_project_credentials")
        # Clear the cache.
        run_local_with_env(ctx, "python2.7 manage.py clear_cache")


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
    if settings.NEW_RELIC_API_KEY and settings.NEW_RELIC_APP_ID:

        print 'Post deployment to New Relic'
        data = urllib.urlencode({
            'deployment[user]': 'Chief',
            'deployment[application_id]': settings.NEW_RELIC_APP_ID
        })
        headers = {'x-api-key': settings.NEW_RELIC_API_KEY}
        try:
            request = urllib2.Request('https://api.newrelic.com/deployments.xml',
                                      data, headers)
            urllib2.urlopen(request, timeout=30)
        except urllib2.URLError as exp:
            print 'Error notifying New Relic: {0}'.format(exp)
