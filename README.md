treeherder-service
==================
[![Build Status](https://travis-ci.org/mozilla/treeherder-service.png?branch=master)](https://travis-ci.org/mozilla/treeherder-service)
[![Code Health](https://landscape.io/github/mozilla/treeherder-service/master/landscape.png)](https://landscape.io/github/mozilla/treeherder-service/master)


#### Description
[Treeherder](https://treeherder.mozilla.org) is a reporting dashboard for Mozilla checkins. It allows users to see the results of automatic builds and their respective tests. **Treeherder-service** manages the etl layer for data ingestion, web services, and the data model behind Treeherder.

Treeherder is comprised of this repo for providing those back end services, and several other component repos:

* [treeherder-ui](https://github.com/mozilla/treeherder-ui) for the front end UI.
* [treeherder-client](https://github.com/mozilla/treeherder-client) for data submission.
* [treeherder-node](https://github.com/mozilla/treeherder-node) NodeJS interface.


#### Instances
Treeherder exists on three instances, [dev](http://treeherder-dev.allizom.org) for treeherder development, [stage](https://treeherder.allizom.org) for pre-deployment validation, and [production](https://treeherder.mozilla.org) for actual use.


#### Installation
The steps to install the treeherder-service are provided [here](https://treeherder-service.readthedocs.org/en/latest/installation.html).


#### Links

Visit our project tracking Wiki at:  
https://wiki.mozilla.org/Auto-tools/Projects/Treeherder

Visit our **readthedocs** page for other setup and configuration at:  
https://treeherder-service.readthedocs.org/en/latest/index.html

File any bugs you may encounter [here](https://bugzilla.mozilla.org/enter_bug.cgi?product=Tree+Management&component=Treeherder).
