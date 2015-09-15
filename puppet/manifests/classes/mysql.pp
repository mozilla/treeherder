# mysqldev and mysql service need to be parametrized
# based on the OS
$mysqldev = $operatingsystem ? {
    ubuntu => libmysqld-dev,
    default => mysql-devel
}

$mysqlservice = $operatingsystem ? {
    Amazon => mysqld,
    default => mysql

}

class mysql {
  package { 'mysql-server-5.6':
    ensure => installed
  }

  package { $mysqldev:
    ensure => installed
  }

  service { $mysqlservice:
    ensure => running,
    enable => true,
    require => Package['mysql-server-5.6'],
  }

  if $operatingsystem == 'ubuntu'{
    file{"/etc/mysql/my.cnf":
      source => "${PROJ_DIR}/puppet/files/mysql/my.cnf",
      owner => "root", group => "root", mode => 0644,
      notify => Service[$mysqlservice],
      require => [
          Package['mysql-server-5.6']
      ]
    }
  }

  exec { "create-db":
    unless => "mysql -uroot treeherder",
    command => "mysql -uroot -e \"create database treeherder;\"",
    require => Service[$mysqlservice],
  }

  exec { "grant-db-privs":
    unless => "mysql -u${DB_USER} -p${DB_PASS}",
    command =>  "mysql -uroot -e \"
     CREATE USER '${DB_USER}'@'%' IDENTIFIED BY '${DB_PASS}';
     CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
     GRANT ALL PRIVILEGES ON *.* to '${DB_USER}'@'%';
     GRANT ALL PRIVILEGES ON *.* to '${DB_USER}'@'localhost';\"",
    require => [Service[$mysqlservice], Exec["create-db"]]
  }

}
