class treeherder::db{
    include mysql
    class { 'mysql::server':
        config_hash => { 
            'root_password' => '',
            'bind_address' => '0.0.0.0',
        }
    }
    mysql::db { 'mydb':
        user     => 'dbuser',
        password => 'dbpass',
        host     => 'localhost',
        grant    => ['all'],
    }
}