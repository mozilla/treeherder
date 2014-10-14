===============
Developer Setup
===============

Check out the code from the `github project`_::

    git clone git://github.com/mozilla/django-browserid.git
    cd django-browserid

Create a `virtualenv`_ (the example here uses `virtualenvwrapper`_)
and install all development packages::

    mkvirtualenv django-browserid
    pip install -r requirements.txt

Here is how to run the test suite::

    python runtests.py

You can also run the tests in all the Python/Django environment
combinations using tox::

    pip install tox
    tox

Here is how to build the documentation::

    make -C docs/ html

.. _`github project`: https://github.com/mozilla/django-browserid
.. _virtualenv: http://www.virtualenv.org/
.. _virtualenvwrapper: http://virtualenvwrapper.readthedocs.org/
