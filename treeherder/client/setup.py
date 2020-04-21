import io
import os
import re

from setuptools import setup


def read(*names, **kwargs):
    # Taken from https://packaging.python.org/en/latest/single_source_version.html
    with io.open(
        os.path.join(os.path.dirname(__file__), *names), encoding=kwargs.get("encoding", "utf8")
    ) as fp:
        return fp.read()


def find_version(*file_paths):
    # Taken from https://packaging.python.org/en/latest/single_source_version.html
    version_file = read(*file_paths)
    version_match = re.search(r"^__version__ = ['\"]([^'\"]*)['\"]", version_file, re.M)
    if version_match:
        return version_match.group(1)
    raise RuntimeError("Unable to find version string.")


setup(
    name='treeherder-client',
    version=find_version('thclient', 'client.py'),
    description='Python library to retrieve data from the Treeherder API',
    classifiers=[
        'Environment :: Console',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: Mozilla Public License 2.0 (MPL 2.0)',
        'Natural Language :: English',
        'Operating System :: OS Independent',
        'Programming Language :: Python',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.6',
        'Programming Language :: Python :: 3.7',
        'Topic :: Software Development :: Libraries :: Python Modules',
    ],
    keywords='',
    author='Mozilla Automation and Testing Team',
    author_email='tools@lists.mozilla.org',
    url='https://github.com/mozilla/treeherder',
    license='MPL',
    packages=['thclient'],
    python_requires='>=3',
    install_requires=['requests==2.22.0'],
)
