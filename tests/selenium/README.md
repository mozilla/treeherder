# Tests for Mozilla's Treeherder
This repository contains tests for [Mozilla's Treeherder](https://treeherder.mozilla.org/).

[![license](https://img.shields.io/badge/license-MPL%202.0-blue.svg)](https://github.com/mozilla/treeherder-tests/blob/master/LICENSE)
"""License needs to be updated
[![travis](https://img.shields.io/travis/mozilla/treeherder-tests.svg?label=travis)](http://travis-ci.org/mozilla/treeherder-tests/)
"""Travis needs to be set up in Treeherder
[![stage](https://img.shields.io/jenkins/s/https/webqa-ci.mozilla.com/treeherder.stage.svg?label=stage)](https://webqa-ci.mozilla.com/job/treeherder.stage/)
"""Stage job info need to be updated
[![updates](https://pyup.io/repos/github/mozilla/treeherder-tests/shield.svg)](https://pyup.io/repos/github/mozilla/treeherder-tests/)
"""Repo needs to be updated
[![python 3](https://pyup.io/repos/github/mozilla/treeherder-tests/python-3-shield.svg)](https://pyup.io/repos/github/mozilla/treeherder-tests/)
"""Repo needs to be updated

## Getting involved
We love working with contributors to fill out the test coverage for Treeherder,
but it does require a few skills. By contributing to our test suite you will
have an opportunity to learn and/or improve your skills with Python, Selenium
WebDriver, GitHub, virtual environments, the Page Object Model, and more.

For some resources for learning about these technologies, take a look at our
documentation on [running Web QA automated tests][running-tests].

All of [these awesome contributors][contributors] have opened pull requests against this repository.
"""Link needs to be updated

## Questions are always welcome
While we take pains to keep our documentation updated, the best source of
information is those of us who work on the project. Don't be afraid to join us
in irc.mozilla.org [#fx-test][irc] to ask questions about our tests. We also
have a [mailing list][list] available that you are welcome to join and post to.

## How to run the tests locally

### Clone the repository
If you have cloned this project already then you can skip this, otherwise you'll
need to clone this repo using Git. If you do not know how to clone a GitHub
repository, check out this [help page][git-clone] from GitHub.

If you think you would like to contribute to the tests by writing or maintaining
them in the future, it would be a good idea to create a fork of this repository
first, and then clone that. GitHub also has great documentation for
[forking a repository][git-fork].

### Run the tests
* Install the Python packages that are needed to run our tests.
* [Install Tox][tox].

Tests are run using the command line. Type `tox`.

To run against a different environment, pass in a value for `--base-url`, like
so:

```bash
$ tox -e tests -- --base-url https://treeherder.allizom.org
```

The pytest plugin that we use for running tests has a number of advanced
command line options available. The full documentation for the plugin can be found
[here][pytest-selenium].

[contributors]: https://github.com/mozilla/treeherder-tests/contributors
[git-clone]: https://help.github.com/articles/cloning-a-repository/
[git-fork]: https://help.github.com/articles/fork-a-repo/
[irc]: http://widget01.mibbit.com/?settings=1b10107157e79b08f2bf99a11f521973&server=irc.mozilla.org&channel=%23fx-test
[list]: https://groups.google.com/a/mozilla.com/forum/#!aboutgroup/firefox-test-engineering
[pytest-selenium]: http://pytest-selenium.readthedocs.org/
[running-tests]: https://developer.mozilla.org/en-US/docs/Mozilla/QA/Running_Web_QA_automated_tests
[tox]: https://tox.readthedocs.io/en/latest/install.html
