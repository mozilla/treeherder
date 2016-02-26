class varnish {
  $varnish_config_file = "/etc/default/varnish"

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

  exec { "update_varnish_port":
    require => Package["varnish"],
    command => "sed -i '/^DAEMON_OPTS=\"-a :6081* / s/6081/80/' ${$varnish_config_file}",
    unless => "grep 'DAEMON_OPTS=\"-a :80' ${varnish_config_file}",
    before => Service["varnish"],
    notify => Service["varnish"],
  }
}
