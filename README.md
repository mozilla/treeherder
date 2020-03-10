# treeherder

[![What's Deployed](https://img.shields.io/badge/whatsdeployed-prototype,stage,prod-green.svg)](https://whatsdeployed.io/s-dqv)
[![Build Status](https://travis-ci.org/mozilla/treeherder.png?branch=master)](https://travis-ci.org/mozilla/treeherder)
[![Node dependencies Status](https://david-dm.org/mozilla/treeherder/status.svg)](https://david-dm.org/mozilla/treeherder)
[![Node devDependencies Status](https://david-dm.org/mozilla/treeherder/dev-status.svg)](https://david-dm.org/mozilla/treeherder?type=dev)
[![Documentation Status](https://readthedocs.org/projects/treeherder/badge/?version=latest)](https://treeherder.readthedocs.io/?badge=latest)

#### Description

[Treeherder](https://treeherder.mozilla.org) is a reporting dashboard for Mozilla checkins. It allows users to see the results of automatic builds and their respective tests. The Treeherder service manages the etl layer for data ingestion, web services, and the data model behind Treeherder.

#### Instances

Treeherder exists on two instances, [stage](https://treeherder.allizom.org) for pre-deployment validation, and [production](https://treeherder.mozilla.org) for actual use.

#### Installation

The steps to run Treeherder are provided [here](https://treeherder.readthedocs.io/installation.html).

The steps to run only the UI are provided [here](https://treeherder.readthedocs.io/installation.html#ui-development).

#### Links

Visit our project tracking Wiki at:
<https://wiki.mozilla.org/EngineeringProductivity/Projects/Treeherder>

Visit our **readthedocs** page for other setup and configuration at:
<https://treeherder.readthedocs.io>

File any bugs you may encounter [here](https://bugzilla.mozilla.org/enter_bug.cgi?product=Tree+Management&component=Treeherder).


#### Contributing

Firstly, ask if the bug is available and manifest your interest in contributing to it. One of the maintainers will **assign** you the bug. Only then you should work on it.

After adressing the issue, make sure [every test passes](https://treeherder.readthedocs.io/testing.html) before sending a pull request.

We also recommend using [`git rebase`](https://git-scm.com/docs/git-rebase). There are less conflicts this way and the git history is cleaner.

##### Sending a Pull Request
We receive contributions from both Bugzilla and Github. We have some specifications to keep track of them:

1. If your bug comes from **Bugzilla**

    After addressing the issue, please send a pull request to this repository, with the **Bugzilla's number ID** in the **title**.

    `"Bug xxxxxx - [title of the bug or brief explanation]"`

    For example: "Bug 123456 - Fix scrolling behavior in Perfherder"

2. If your bug comes from **Github**

    In the **description** of the pull request, please mention the **issue number**. That can be done by typing #[issue's number].
    
    For example: "This pull request fixes #5135".
    
    Github automatically links both issue and pull request to one another.
