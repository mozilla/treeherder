class mysql {
  package { 'mysql-server-5.6':
    ensure => installed
  }

  package { 'libmysqld-dev':
    ensure => installed
  }

  service { 'mysql':
    ensure => running,
    enable => true,
    require => Package['mysql-server-5.6'],
  }

  file{"/etc/mysql/my.cnf":
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

  exec { "grant-db-privs":
    unless => "mysql -u${DB_USER} -p${DB_PASS}",
    command =>  "mysql -uroot -e \"
     CREATE USER '${DB_USER}'@'%' IDENTIFIED BY '${DB_PASS}';
     CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
     GRANT ALL PRIVILEGES ON *.* to '${DB_USER}'@'%';
     GRANT ALL PRIVILEGES ON *.* to '${DB_USER}'@'localhost';\"",
    require => [Service['mysql'], Exec["create-db"]]
  }

}
