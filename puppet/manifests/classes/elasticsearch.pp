class elasticsearch {
  $es_version = "2.3.5"
  $es_url = "https://download.elastic.co/elasticsearch/release/org/elasticsearch/distribution/deb/elasticsearch/${es_version}/elasticsearch-${es_version}.deb"

  package { 'openjdk-7-jre-headless':
    ensure => installed
  }

  # Once we're using Ubuntu 16.04's newer dpkg we can pipe the download and skip creating a file.
  exec { "install-elasticsearch":
    user => "${APP_USER}",
    command => "curl -sSo ${HOME_DIR}/elasticsearch.deb ${es_url} && sudo dpkg -i ${HOME_DIR}/elasticsearch.deb",
    unless => "test \"$(dpkg-query --show --showformat='\${Version}' elasticsearch 2>&1)\" = '${es_version}'",
  }

  service { 'elasticsearch':
    ensure => running,
    enable => true,
    require => [
      Package['openjdk-7-jre-headless'],
      Exec['install-elasticsearch'],
    ],
  }
}
