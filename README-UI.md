treeherder-ui
=============

#### Description
[Treeherder](https://treeherder.mozilla.org) is a reporting dashboard for Mozilla checkins. It allows users to see the results of automatic builds and their respective tests.


#### Instances
Treeherder exists on two instances, [stage](https://treeherder.allizom.org) for pre-deployment validation, and [production](https://treeherder.mozilla.org) for actual use.


#### Development
The easiest way to run Treeherder's UI locally is to simply clone this repo, install [Node.js](http://nodejs.org/download/) and then from the root of the repo:

```
cp webapp/app/js/config/sample.local.conf.js webapp/app/js/config/local.conf.js
./webapp/scripts/web-server.js
```

The UI can then be viewed at [http://localhost:8000/index.html](http://localhost:8000/index.html).

Data will be pulled from the production instance API by default. See the [installation docs](https://treeherder-service.readthedocs.org/en/latest/installation.html) for more options, how to run the tests & using the Vagrant project for a more robust environment that also allows you to run the back-end locally.


#### Links

Visit our project tracking Wiki at:  
https://wiki.mozilla.org/Auto-tools/Projects/Treeherder

Visit our **readthedocs** page for more detailed documentation at:  
https://treeherder-service.readthedocs.org/en/latest/index.html

File any bugs you may encounter [here](https://bugzilla.mozilla.org/enter_bug.cgi?product=Tree+Management&component=Treeherder).
