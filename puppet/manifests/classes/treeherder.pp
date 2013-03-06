# playdoh-specific commands that get playdoh all going so you don't
# have to.

# TODO: Make this rely on things that are not straight-up exec.
class treeherder {
    exec { "create_mysql_database":
        command => "mysql -uroot -B -e'CREATE DATABASE $DB_NAME CHARACTER SET utf8;'",
        unless  => "mysql -uroot -B --skip-column-names -e 'show databases' | /bin/grep '$DB_NAME'",
    }

    exec { "grant_mysql_database":
        command => "mysql -uroot -B -e'GRANT ALL PRIVILEGES ON $DB_NAME.* TO $DB_USER@localhost # IDENTIFIED BY \"$DB_PASS\"'",
        unless  => "mysql -uroot -B --skip-column-names mysql -e 'select user from user' | grep '$DB_USER'",
        require => Exec["create_mysql_database"];
    }
}
