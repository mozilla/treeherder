Code Style
==========

Python imports
--------------

[isort](https://github.com/timothycrosley/isort) enforces the following Python global import order:

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

  ```python
  from django.db import (models,
                         transaction)
  ```

The quickest way to correct import style locally is to let isort make the changes for you - see
[running the tests](common_tasks.html#running-the-tests).

Note: It's not possible to disable isort wrapping style checking, so for now we've chosen the
most deterministic [wrapping mode](https://github.com/timothycrosley/isort#multi-line-output-modes)
to reduce the line length guess-work when adding imports, even though it's not the most concise.

UI
--

We use the [Airbnb](https://github.com/airbnb/javascript) style guide for Javascript and validate it with ESlint (see Validating Javascript in the [Installation section](installation.html#validating-javascript)). For CSS, we use [reactstrap](https://reactstrap.github.io/) and Bootstrap's utility classes as much as possible before adding custom CSS to a style sheet. Any custom style that can be made reusable should be named generically and stored in the ``ui/css/treeherder-global.css`` file.

Imports in JS/JSX must be ordered like so (with newlines between each group):
1. external modules (eg `'react'`)
2. modules from a parent directory (eg `'../foo'`)
3. "sibling" modules from the same or a sibling's directory (eg `'./bar'` or './bar/baz')
