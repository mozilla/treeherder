Development
===========

The UI of Treeherder and related components is primarily done in `AngularJS`_.
However, we recently have added the use of `ReactJS`_ to certain areas to improve
performance where Angular's ng-repeat is just too slow.

Modifying JSX files
-------------------

ReactJS components are written in ``JSX`` files, which must be compiled.  To
do so, you must ensure you have ``npm`` installed and execute::

    npm run build-react

This will start a "watcher" that will continuously recompile any ``JSX`` file
in the ``ui/js/react_components`` folder.  They are compiled to a single
file called ``react-compiled.js``.

.. _AngularJS: https://angularjs.org/
.. _ReactJS: https://facebook.github.io/react/
