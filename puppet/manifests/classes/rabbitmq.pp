class rabbitmq {
  package { "rabbitmq-server":
    ensure => installed;
  }

  service { "rabbitmq-server":
    ensure => running,
    enable => true,
    require => Package['rabbitmq-server'],
  }

  exec{ "create-rabbitmq-user":
    command => "rabbitmqctl add_user ${RABBITMQ_USER} ${RABBITMQ_PASSWORD}",
    unless => "rabbitmqctl list_users | grep ${RABBITMQ_USER}",
    require => Service['rabbitmq-server'],
  }

  exec{ "create-rabbitmq-vhost":
    command => "rabbitmqctl add_vhost ${RABBITMQ_VHOST}",
    unless => "rabbitmqctl list_vhosts | grep ${RABBITMQ_VHOST}",
    require => Service['rabbitmq-server'],
  }

  exec{ "grant-rabbitmq-permissions":
    command => "rabbitmqctl set_permissions -p ${RABBITMQ_VHOST} ${RABBITMQ_USER} \".*\" \".*\" \".*\"",
    unless => "rabbitmqctl list_user_permissions ${RABBITMQ_USER} | grep -P \"${RABBITMQ_VHOST}\t.*\t.*\t.*\"",
    require => [
      Exec["create-rabbitmq-user"],
      Exec["create-rabbitmq-vhost"]
    ],
  }
}
