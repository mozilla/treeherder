from setuptools import setup

version = '0.1'

setup(name='perfalert',
      version=version,
      description="Automated regression detection for performance data",
      classifiers=[
          'Environment :: Console',
          'Intended Audience :: Developers',
          'License :: OSI Approved :: Mozilla Public License 2.0 (MPL 2.0)',
          'Natural Language :: English',
          'Operating System :: OS Independent',
          'Programming Language :: Python',
          'Topic :: Software Development :: Libraries :: Python Modules',
      ],
      keywords='',
      author='Mozilla Automation and Testing Team & others',
      author_email='tools@lists.mozilla.org',
      url='https://github.com/mozilla/treeherder',
      license='MPL',
      packages=['perfalert'],
      zip_safe=False,
      install_requires=[]
      )
