class elasticsearch {
  $es_version = "5.2.1"
  $es_url = "https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-${es_version}.deb"
  $es_config_file = "/etc/default/elasticsearch"

  package { 'openjdk-8-jre-headless':
    ensure => installed
  }

  # Once we're using Ubuntu 16.04's newer dpkg we can pipe the download and skip creating a file.
  exec { "install-elasticsearch":
    user => "${APP_USER}",
    command => "curl -sSo ${HOME_DIR}/elasticsearch.deb ${es_url} && sudo dpkg -i ${HOME_DIR}/elasticsearch.deb",
    notify => Service['elasticsearch'],
    unless => "test \"$(dpkg-query --show --showformat='\${Version}' elasticsearch 2>&1)\" = '${es_version}'",
  }

  exec { "set-elasticsearch-heap-size":
    require => Exec['install-elasticsearch'],
    command => "echo 'ES_JAVA_OPTS=\"-Xms256m -Xmx1g\"' >> ${es_config_file}",
    unless => "grep 'ES_JAVA_OPTS=\"-Xms256m -Xmx1g\"' ${es_config_file}",
    notify => Service['elasticsearch'],
  }

  service { 'elasticsearch':
    ensure => running,
    enable => true,
    require => [
      Package['openjdk-8-jre-headless'],
      Exec['set-elasticsearch-heap-size'],
    ],
  }
}
