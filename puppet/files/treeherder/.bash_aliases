function thelp {
    echo "
    Treeherder-specific helpful aliases:

    thlogs             - Open several top-priority logs in succession using \"less\"
    thlogsdelete       - Delete all the top-priority logs
    thqueues           - Output the status of the Treeherder celery queues
    thqueuespurge      - Empty all the treeherder celery queues
    threstartmemcached - Restart memcached
    threstartrabbitmq  - Restart rabbitmq
    thresetall         - Delete logs, purge queues and reset memcached
    tabname            - Set the title text of the current shell tab
    "
}

function tabname {
  printf "\e]1;$1\a"
}

# the noteworthy treeherder logs for debugging
TH_LOG_LIST=(
/var/log/celery/celery_worker_log_parser.log
/var/log/celery/worker_log_parser_err.log
/var/log/celery/celery_worker_buildapi.log
/var/log/celery/celery_worker_pushlog.log
/var/log/celery/worker_buildapi_err.log
/var/log/celery/celery_worker.log
/var/log/celery/worker_pushlog_err.log
/var/log/treeherder/treeherder.log
/var/log/gunicorn/treeherder_error.log
)

function thlogs {
    # walk through each log with ``less`` to check it out.
    # quitting moves to the next log.

    for i in "${TH_LOG_LIST[@]}"; do
        if [ -f "$i" ]; then
            tabname $i
            less $i
        fi
    done
    tabname vagrant
}

function thlogsdelete {
    # delete all the logs in TH_LOG_LIST

    for i in "${TH_LOG_LIST[@]}"; do
        if [ -f "$i" ]; then
            rm $i
        fi
    done
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
