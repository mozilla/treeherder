$varnish_port_file = $operatingsystem ? {
  ubuntu => "/etc/default/varnish",
  default => "/etc/sysconfig/varnish",
}


class varnish {
  package { "varnish":
    ensure => installed;
  }

  service { "varnish":
    ensure => running,
    enable => true,
    require => Package['varnish'],
  }

  file {"/etc/varnish/default.vcl":
    content => template("${PROJ_DIR}/puppet/files/varnish/default.vcl"),
    owner => "root", group => "root", mode => 0644,
    require => [Package["varnish"]],
    before => Service["varnish"],
    notify => Service["varnish"],
  }

  exec { "sed -i '/^DAEMON_OPTS=\"-a :6081* / s/6081/80/' ${varnish_port_file}":
    require => [Package[$apache_devel]],
    before => [
      Service["varnish"]
    ],
    notify => Service["varnish"],
  }

}
