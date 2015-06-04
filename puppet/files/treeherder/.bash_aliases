function tabname {
  printf "\e]1;$1\a"
}

# the noteworthy treeherder logs for debugging
export TH_LOG_LIST=(/var/log/celery/celery_worker_log_parser.log
          /var/log/celery/worker_log_parser_err.log
          /var/log/celery/celery_worker_buildapi.log
          /var/log/celery/celery_worker_pushlog.log
          /var/log/celery/worker_buildapi_err.log
          /var/log/celery/celery_worker.log
          /var/log/celery/worker_pushlog_err.log
          /var/log/treeherder/treeherder.log
          /var/log/gunicorn/treeherder_error.log
    )

function th_logs {
    # walk through each log with ``less`` to check it out.
    # quitting moves to the next log.

    for i in "${TH_LOG_LIST[@]}"
    do
        if [ -f $i ]
        then
            tabname $i
            less $i
        fi
    done
    tabname vagrant
}

function th_logs_delete {
    # delete all the logs in TH_LOG_LIST

    for i in "${TH_LOG_LIST[@]}"
    do
        if [ -f $i ]
        then
            rm $i
        fi
    done
}

function th_queues {
    # list the treeherder queue sizes

    sudo rabbitmqctl list_queues -p treeherder
}

function th_queues_purge {
    # purge the celery queues

    celery -A treeherder purge
}

function th_reset_all {
    th_queues_purge
    th_logs_delete
    sudo service memcached restart
}
