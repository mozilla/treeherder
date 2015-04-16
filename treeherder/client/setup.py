# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from setuptools import setup

version = '1.0'

setup(name='treeherder-client',
      version=version,
      description="Python library to submit data to treeherder-service",
      long_description="""\
""",
      classifiers=[], # Get strings from http://pypi.python.org/pypi?%3Aaction=list_classifiers
      keywords='',
      author='Mozilla Automation and Testing Team',
      author_email='tools@lists.mozilla.org',
      url='https://github.com/mozilla/treeherder-client',
      license='MPL',
      packages=['thclient'],
      zip_safe=False,
      install_requires=['oauth2'],
      test_suite='thclient.tests',
      tests_require=["mock"],
      )
