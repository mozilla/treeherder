$varnish_port_file = $operatingsystem ? {
  ubuntu => "/etc/default/varnish",
  default => "/etc/sysconfig/varnish",
}

$varnish_port_change = $operatingsystem ? {
  ubuntu => "sed -i '/^DAEMON_OPTS=\"-a :6081* / s/6081/80/' ${varnish_port_file}",
  default => "sed -i '/^VARNISH_LISTEN_PORT=6081$/ s/6081/80/' ${varnish_port_file}",
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
    require => Package["varnish"],
    before => Service["varnish"],
    notify => Service["varnish"],
  }

  exec { $varnish_port_change:
    require => Package["varnish"],
    before => Service["varnish"],
    notify => Service["varnish"],
  }
}
