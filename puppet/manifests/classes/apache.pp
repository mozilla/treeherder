$apache_devel = $operatingsystem ? {
  ubuntu => "apache2-dev",
  default => "httpd-devel",
}

$apache_vhost_path = $operatingsystem ? {
  ubuntu => "/etc/apache2/sites-enabled",
  default => "/etc/httpd/conf.d",
}

$apache_service = $operatingsystem ? {
  ubuntu => "apache2",
  default => "httpd",
}

class apache {
  package { $apache_devel:
    ensure => present
  }

  package { $apache_service:
    ensure => present
  }

  file { "${apache_vhost_path}/treeherder-service.conf":
    content => template("${PROJ_DIR}/puppet/files/apache/treeherder-service.conf"),
    owner => "root", group => "root", mode => 0644,
    require => [Package[$apache_devel]],
    notify => Service[$apache_service],
  }

  service { $apache_service:
    ensure => running,
    enable => true,
    require => [
      File["${apache_vhost_path}/treeherder-service.conf"]
    ],
  }

  if $operatingsystem == 'ubuntu'{
    /*by default ubuntu doesn't have these modules enabled*/
    exec {
      'a2enmod rewrite':
        onlyif => 'test ! -e /etc/apache2/mods-enabled/rewrite.load',
        before => Service[$apache_service];
      'a2enmod proxy':
        onlyif => 'test ! -e /etc/apache2/mods-enabled/proxy.load',
        before => Service[$apache_service];
      'a2enmod proxy_http':
        onlyif => 'test ! -e /etc/apache2/mods-enabled/proxy_http.load',
        before => Service[$apache_service];
    }
  }
}
