treeherder-service
==================
[![Build Status](https://travis-ci.org/mozilla/treeherder-service.png?branch=master)](https://travis-ci.org/mozilla/treeherder-service)
[![Code Health](https://landscape.io/github/mozilla/treeherder-service/master/landscape.png)](https://landscape.io/github/mozilla/treeherder-service/master)


#### Description
<strong><a href="https://treeherder.mozilla.org" target=_newtab>Treeherder</a></strong> is a reporting dashboard for Mozilla checkins. It allows users to see the results of automatic builds and their respective tests. **Treeherder-service** manages the etl layer for data ingestion, web services, and the data model behind Treeherder.

Treeherder is comprised of this repo for providing those back end services, and several other component repos:

A <a href="https://github.com/mozilla/treeherder-ui" target=_newtab>treeherder-ui</a> repo for the front end UI.

A <a href="https://github.com/mozilla/treeherder-client" target=_newtab>treeherder-client</a> for data submission.

A <a href="https://github.com/mozilla/treeherder-node" target=_newtab>treeherder-node</a> NodeJS interface.


#### Instances
Treeherder exists on three instances, <a href="http://treeherder-dev.allizom.org" target=_newtab>dev</a> for treeherder development, <a href="https://treeherder.allizom.org" target=_newtab>stage</a> for pre-deployment validation, and <a href="https://treeherder.mozilla.org" target=_newtab>production</a> for actual use.


#### Installation
The steps to install the treeherder-service are provided <a href="https://treeherder-service.readthedocs.org/en/latest/installation.html" target=_newtab>here</a>.


#### Links

Visit our project tracking Wiki at:  
https://wiki.mozilla.org/Auto-tools/Projects/Treeherder

Visit our **readthedocs** page for other setup and configuration at:  
https://treeherder-service.readthedocs.org/en/latest/index.html

File any bugs you may encounter [here](https://bugzilla.mozilla.org/enter_bug.cgi?product=Tree+Management&component=Treeherder).
