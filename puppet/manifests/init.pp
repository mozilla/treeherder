stage { [pre, post]: }
Stage[pre] -> Stage[main] -> Stage[post]

class { apt-update: stage => pre }

node default{
    include treeherder
}