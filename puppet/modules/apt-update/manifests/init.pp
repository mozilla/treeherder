class apt-update{
    exec { '/usr/bin/apt-get update && touch /tmp/apt-get-update':
        alias => 'apt-get-update',
        creates => '/tmp/apt-get-update',
    }
}