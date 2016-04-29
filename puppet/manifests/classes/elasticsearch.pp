class elasticsearch {
  package { 'openjdk-7-jre':
    ensure => installed
  }

  package { 'elasticsearch':
    ensure => installed
  }

  service { 'elasticsearch':
    ensure => running,
    enable => true,
    require => [
      Package['openjdk-7-jre'],
      Package['elasticsearch'],
    ],
  }
}
