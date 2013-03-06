# Get mysql up and running
class mysql {
    package { "mysql-server":
        ensure => installed;
    }
        
    package { "libmysqld-dev":
        ensure => installed;
    }

    service { "mysql":
        ensure => running,
        enable => true,
        require => Package['mysql-server'];
    }
}
