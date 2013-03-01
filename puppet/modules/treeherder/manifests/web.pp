class treeherder::web{
    include apache
    apache::vhost::proxy { '192.168.33.10':
        port          => '80',
        dest          => 'http://127.0.0.1:8000',
        priority      => '10',
        template      => 'treeherder/vhost-proxy.conf.erb',
        vhost_name    => '192.168.33.10',
        no_proxy_uris => ['/static/','/media/',],
    }
}