class treeherder{

    include treeherder::web
    include treeherder::db
    include treeherder::python

    $document_root = "/home/vagrant/treeherder/treeherder-service/webapp/"
    $base_dir = "/home/vagrant/treeherder/"
    $venv_dir = "/home/vagrant/venv/"
}