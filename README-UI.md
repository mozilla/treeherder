treeherder-ui
=============

#### Description
<strong><a href="https://treeherder.mozilla.org" target=_newtab>Treeherder</a></strong> is a reporting dashboard for Mozilla checkins. It allows users to see the results of automatic builds and their respective tests. It is comprised of this repo for the front end, and several other component repos.

A <a href="https://github.com/mozilla/treeherder-service" target=_newtab>treeherder-service</a> repo for backend services.

A <a href="https://github.com/mozilla/treeherder-client" target=_newtab>treeherder-client</a> for data submission.

A <a href="https://github.com/mozilla/treeherder-node" target=_newtab>treeherder-node</a> NodeJS interface.


#### Instances
Treeherder exists on three instances, <a href="http://treeherder-dev.allizom.org" target=_newtab>dev</a> for treeherder development, <a href="https://treeherder.allizom.org" target=_newtab>stage</a> for pre-deployment validation, and <a href="https://treeherder.mozilla.org" target=_newtab>production</a> for actual use.


#### Development
The easiest way to run treeherder-ui locally is to simply clone this repo, install [Node.js](http://nodejs.org/download/) and then from the root of the repo:

```
cd webapp
cp app/js/config/sample.local.conf.js app/js/config/local.conf.js
./scripts/web-server.js
```

The UI can then be viewed at [http://localhost:8000/app/index.html](http://localhost:8000/app/index.html).

Data will be pulled from the production instance API by default. See the [installation docs](https://treeherder-ui.readthedocs.org/en/latest/installation.html) for more options, how to run the tests & using the Vagrant project for a more robust environment that also allows you to run the back-end locally.


#### Links

Visit our project tracking Wiki at:  
https://wiki.mozilla.org/Auto-tools/Projects/Treeherder

Visit our **readthedocs** page for more detailed documentation at:  
https://treeherder-ui.readthedocs.org/en/latest/index.html

File any bugs you may encounter [here](https://bugzilla.mozilla.org/enter_bug.cgi?product=Tree+Management&component=Treeherder).
