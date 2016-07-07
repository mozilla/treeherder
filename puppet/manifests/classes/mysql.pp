class mysql {
  package { 'mysql-server-5.6':
    ensure => installed
  }

  service { 'mysql':
    ensure => running,
    enable => true,
    require => Package['mysql-server-5.6'],
  }

  # We cannot symlink since shared folders are world-writeable on
  # Windows hosts, so MySQL server would reject the config file.
  file{"/etc/mysql/conf.d/treeherder.cnf":
    source => "${PROJ_DIR}/puppet/files/mysql/my.cnf",
    owner => "root", group => "root", mode => 0644,
    notify => Service['mysql'],
    require => [
        Package['mysql-server-5.6']
    ]
  }

  exec { "create-db":
    unless => "mysql -uroot treeherder",
    command => "mysql -uroot -e \"create database treeherder;\"",
    require => Service['mysql'],
  }

  # The default `root@localhost` grant only allows loopback interface connections.
  exec { "grant-db-privs":
    unless => "mysql -uroot -e \"SHOW GRANTS FOR root@'%'\"",
    command =>  "mysql -uroot -e \"GRANT ALL PRIVILEGES ON *.* to root@'%'\"",
    require => Service['mysql']
  }

}
