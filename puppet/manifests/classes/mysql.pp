# Get mysql up and running
class mysql {
    package { "mysql-server":
        ensure => installed;
    }
        
    package { "libmysqld-dev":
        ensure => installed;
    }

    file{"/etc/mysql/my.cnf":
        source => "$PROJ_DIR/puppet/files/mysql/my.cnf",
        owner => "root", group => "root", mode => 0644,
        notify => Service["mysql"],
        require => [
            Package['mysql-server']
        ],
    }

    service { "mysql":
        ensure => running,
        enable => true,
        require => Package['mysql-server'];
    }

    exec { "create-${DB_NAME}-db":
        unless => "mysql -uroot ${DB_NAME}",
        command => "mysql -uroot -e \"create database ${DB_NAME};\"",
        require => Service["mysql"],
    }

    exec { "grant-${name}-db":
        unless => "mysql -u${DB_USER} -p${DB_PASS} ${DB_NAME}",
        command => "mysql -uroot -e \"grant all privileges on *.* to ${DB_USER}@'%' identified by '${DB_PASS}';\"",
        require => [Service["mysql"], Exec["create-${DB_NAME}-db"]]
    }
}
