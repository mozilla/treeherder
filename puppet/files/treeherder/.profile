# Source .bashrc, since the default .profile we're replacing did so.
. "$HOME/.bashrc"

# Activate the virtualenv.
. "$HOME/venv/bin/activate"

PS1='\[\e[0;31m\]\u\[\e[m\] \[\e[1;34m\]\w\[\e[m\] \$ '
echo "Type 'thelp' to see a list of Treeherder-specific helper aliases"
cd "$HOME/treeherder"

# Helper aliases

function thelp {
    echo "
    Treeherder-specific helpful aliases:

    thpurge            - Empty all databases and reset all queues (requires vagrant provision afterward)
    thqueues           - Output the status of the Treeherder celery queues
    thqueuespurge      - Empty all the treeherder celery queues
    threstartmemcached - Restart memcached
    threstartrabbitmq  - Restart rabbitmq
    thresetall         - Delete logs, purge queues and reset memcached
    tabname            - Set the title text of the current shell tab
    "
}

function thqueues {
    # list the treeherder queue sizes

    sudo rabbitmqctl list_queues
}

function thqueuespurge {
    # purge the celery queues

    celery -A treeherder purge
}

function threstartmemcached {
    echo "Restarting memcache"
    sudo service memcached restart
}

function threstartrabbitmq {
    echo "Restarting rabbitmq"
    sudo service rabbitmq-server restart
}

function thresetall {
    echo "Deleting logs"
    thlogsdelete

    echo "Deleting celerybeat-schedule"
    if [ -f ~/treeherder/celerybeat-schedule ]; then
        rm ~/treeherder/celerybeat-schedule
    fi

    threstartmemcached
    threstartrabbitmq

    echo "Purging queues"
    thqueuespurge
}

function thpurge {
    ~/treeherder/manage.py flush
    thresetall
    echo
    echo "Please exit vagrant and run 'vagrant provision' to finish"
}
