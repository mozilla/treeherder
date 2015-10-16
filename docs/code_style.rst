Code Style
==========

.. _python-import-style:

Python imports
--------------

`isort <https://github.com/timothycrosley/isort>`_ enforces the following Python global import order:

* ``from __future__ import ...``
* Python standard library
* Third party modules
* Local project imports (absolutely specified)
* Local project imports (relative path, eg: ``from .models import Credentials``)

In addition:

* Each group should be separated by a blank line.
* Within each group, all ``import ...`` statements should be before ``from ... import ...``.
* After that, sort alphabetically by module name.
* When importing multiple items from one module, use this style:

  .. code-block:: python

     from treeherder.client import (HawkAuth,
                                    TreeherderClient)

The quickest way to correct import style locally is to let isort make the changes for you - see :ref:`running the tests <running-tests>`.

Note: It's not possible to disable isort wrapping style checking, so for now we've chosen the most deterministic `wrapping mode <https://github.com/timothycrosley/isort#multi-line-output-modes>`_ to reduce the line length guess-work when adding imports, even though it's not the most concise.
