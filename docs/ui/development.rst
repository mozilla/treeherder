Development
===========

The UI of Treeherder and related components is primarily done in `AngularJS`_.
However, `ReactJS`_ is used in certain circumstances to improve performance
where Angular's ng-repeat is just too slow.

Modifying JSX files
-------------------

ReactJS components are written as ``JSX`` files, which must be compiled.  To
do so, you must ensure you have ``npm`` installed and execute::

    npm run build-react

This will start a "watcher" that will continuously recompile any ``JSX`` file
in the ``ui/js/react_components`` folder.  They are compiled to a single
file called ``ui/js/react-compiled.js``.  Every change you make to any ``JSX``
file in that folder will be recompiled automatically.

.. _AngularJS: https://angularjs.org/
.. _ReactJS: https://facebook.github.io/react/
