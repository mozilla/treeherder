Deployment
==========

The easiest way to deploy all the treeherder services on a server is to let puppet do it.
Once puppet is installed on your machine, clone the treeherder repo on the target machine and create a puppet
manifest like this inside the puppet directory:

.. code-block:: ruby

    import "classes/*.pp"

    $APP_URL="your.webapp.url"
    $APP_USER="your_app_user"
    $APP_GROUP="your_app_group"
    $PROJ_DIR = "/home/${APP_USER}/treeherder-service"
    $VENV_DIR = "/home/${APP_USER}/venv"
    # You can make these less generic if you like, but these are box-specific
    # so it's not required.
    $DB_NAME = "db_name"
    $DB_USER = "db_user"
    $DB_PASS = "db_pass"
    $DB_HOST = "localhost"
    $DB_PORT = "3306"
    $DJANGO_SECRET_KEY = "your-django-secret"
    $RABBITMQ_USER = "your_rabbitmq_user"
    $RABBITMQ_PASSWORD = "your_rabbitmq_pass"
    $RABBITMQ_VHOST = "your_rabbitmq_vhost"
    $RABBITMQ_HOST = "your_rabbitmq_host"
    $RABBITMQ_PORT = "your_rabbitmq_port"

    Exec {
        path => "/usr/local/bin:/usr/bin:/usr/sbin:/sbin:/bin",
    }

    file {"/etc/profile.d/treeherder.sh":
        content => "
    export TREEHERDER_DATABASE_NAME='${DB_NAME}'
    export TREEHERDER_DATABASE_USER='${DB_USER}'
    export TREEHERDER_DATABASE_PASSWORD='${DB_PASS}'
    export TREEHERDER_DATABASE_HOST='${DB_HOST}'
    export TREEHERDER_DATABASE_PORT='${DB_PORT}'
    export TREEHERDER_DEBUG='1'
    export TREEHERDER_DJANGO_SECRET_KEY='${DJANGO_SECRET_KEY}'
    export TREEHERDER_MEMCACHED='127.0.0.1:11211'
    export TREEHERDER_RABBITMQ_USER='${RABBITMQ_USER}'
    export TREEHERDER_RABBITMQ_PASSWORD='${RABBITMQ_PASSWORD}'
    export TREEHERDER_RABBITMQ_VHOST='${RABBITMQ_VHOST}'
    export TREEHERDER_RABBITMQ_HOST='${RABBITMQ_HOST}'
    export TREEHERDER_RABBITMQ_PORT='${RABBITMQ_PORT}'
    "
    }

    class deployment {
        class {
            init: before => Class["mysql"];
            mysql: before  => Class["python"];
            python: before => Class["apache"];
            apache: before => Class["varnish"];
            varnish: before => Class["treeherder"];
            treeherder: before => Class["rabbitmq"];
            rabbitmq:;
        }
    }

    include deployment

As you can see it's very similar to the file used to startup the vagrant environment.
You can run this file with the following command

.. code-block:: bash
  
  (venv)vagrant@precise32:~/treeherder-service$ sudo puppet apply puppet/your_manifest_file.pp

Once puppet has finished, the only thing left to do is to start all the treeherder services (gunicorn, socketio, celery, etc).
The easiest way to do it is via supervisord.
A supervisord configuration file is included in the repo under deployment/supervisord/treeherder.conf.


Securing the connection
-----------------------

To put everything under a SSL connection you may want to use a SSL wrapper like stunnel_. Here is a bacis example
of a stunnel configuration file:

.. code-block:: INI

  cert = /path-to-my-pem-file/credentials.pem

  [https]
  accept  = 443
  connect = 80

.. _stunnel: https://www.stunnel.org

Serving the UI build from the distribution directory
----------------------------------------------------
To serve the UI from the ``treeherder-ui/dist`` directory, from the ``treeherder-ui`` directory run:

.. code-block:: bash

  (venv)vagrant@precise32:~/treeherder-ui$ grunt build

This will build the UI by concatenating and minifying the js and css and move all required assets to a directory called ``dist`` in the repository root of ``treeherder-ui``:
In ``treeherder-service/Vagrantfile`` uncomment this line

.. code-block:: ruby

  puppet.manifest_file = "production.pp"

this puppet manifest sets the web application directory to the ``dist`` directory.
