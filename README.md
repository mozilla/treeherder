treeherder
==================
[![Build Status](https://travis-ci.org/mozilla/treeherder.png?branch=master)](https://travis-ci.org/mozilla/treeherder)
[![Python Requirements Status](https://requires.io/github/mozilla/treeherder/requirements.svg?branch=master)](https://requires.io/github/mozilla/treeherder/requirements/?branch=master)
[![Node Dependency Status](https://david-dm.org/mozilla/treeherder.svg)](https://david-dm.org/mozilla/treeherder)
[![Node devDependency Status](https://david-dm.org/mozilla/treeherder/dev-status.svg)](https://david-dm.org/mozilla/treeherder#info=devDependencies)
[![Documentation Status](https://readthedocs.org/projects/treeherder/badge/?version=latest)](https://readthedocs.org/projects/treeherder/?badge=latest)


#### Description
[Treeherder](https://treeherder.mozilla.org) is a reporting dashboard for Mozilla checkins. It allows users to see the results of automatic builds and their respective tests. The Treeherder service manages the etl layer for data ingestion, web services, and the data model behind Treeherder.


#### Instances
Treeherder exists on two instances, [stage](https://treeherder.allizom.org) for pre-deployment validation, and [production](https://treeherder.mozilla.org) for actual use.


#### Installation
The steps to run Treeherder are provided [here](https://treeherder.readthedocs.org/installation.html).

The steps to run only the UI are provided [here](https://treeherder.readthedocs.org/ui/installation.html).


#### Links

Visit our project tracking Wiki at:
https://wiki.mozilla.org/Auto-tools/Projects/Treeherder

Visit our **readthedocs** page for other setup and configuration at:
https://treeherder.readthedocs.org/

File any bugs you may encounter [here](https://bugzilla.mozilla.org/enter_bug.cgi?product=Tree+Management&component=Treeherder).

#### Autolander (bot)

Autolander is a bot which integrates github and bugzilla workflows.

Features available:
  - Automatic pull request to bugzilla attachment linking.
  - Validates pull request title and commit message formats.
  - [Autolander on Github](https://github.com/mozilla/autolander)
