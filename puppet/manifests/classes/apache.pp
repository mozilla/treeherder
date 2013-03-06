class apache {
            package { "apache2":
                ensure => present,
                before => File['/etc/apache2/sites-enabled/treeherder-service.conf'];
            }

            package { "apache2-dev":
                ensure => present,
                before => [
                    Exec['a2enmod rewrite'],
                    Exec['a2enmod proxy'],
                    Exec['a2enmod proxy_http'],   
                ];
            }

            file { "/etc/apache2/sites-enabled/treeherder-service.conf":
                source => "$PROJ_DIR/puppet/files/apache/treeherder-service.conf",
                owner => "root", group => "root", mode => 0644,
                notify => Service["apache2"],
                require => [
                    Package['apache2']
                ];
            }

            exec {
                'a2enmod rewrite':
                    onlyif => 'test ! -e /etc/apache2/mods-enabled/rewrite.load';
                'a2enmod proxy':
                    onlyif => 'test ! -e /etc/apache2/mods-enabled/proxy.load';
                'a2enmod proxy_http':
                    onlyif => 'test ! -e /etc/apache2/mods-enabled/proxy_http.load';

            }

            service { "apache2":
                ensure => running,
                enable => true,
                require => [
                    Package['apache2'],
                    File['/etc/apache2/sites-enabled/treeherder-service.conf']
                ];
            }

        }
