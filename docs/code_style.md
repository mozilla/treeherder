# Code Style

## Python imports

[isort](https://github.com/timothycrosley/isort) enforces the following Python global import order:

- `from __future__ import ...`
- Python standard library
- Third party modules
- Local project imports (absolutely specified)
- Local project imports (relative path, eg: `from .models import Credentials`)

In addition:

- Each group should be separated by a blank line.
- Within each group, all `import ...` statements should be before `from ... import ...`.
- After that, sort alphabetically by module name.
- When importing multiple items from one module, use this style:

  ```python
  from django.db import (models,
                         transaction)
  ```

The quickest way to correct import style locally is to let isort make the changes for you - see
[running the tests](common_tasks.md#running-the-tests).

Note: It's not possible to disable isort wrapping style checking, so for now we've chosen the
most deterministic [wrapping mode](https://github.com/timothycrosley/isort#multi-line-output-modes)
to reduce the line length guess-work when adding imports, even though it's not the most concise.

## UI

We use Prettier for JS/JSX formatting and the [Airbnb](https://github.com/airbnb/javascript)
guide for non-style related best practices. Both are validated using ESlint (see Validating
Javascript in the [Installation section](installation.md#validating-javascript)).

Prettier is also used to format JSON/CSS/HTML/Markdown/YAML. However these are not supported
by ESLint, so instead are validated using Prettier's CLI. To manually check their formatting
(as well as that of JS/JSX) using Prettier, run `yarn format:check`, or to apply formatting
fixes run `yarn format`.

However we recommend that you instead
[add Prettier to your editor/IDE](https://prettier.io/docs/en/editors.html)
and enable "format on save" for the most seamless development workflow.

Imports in JS/JSX must be ordered like so (with newlines between each group):

1. external modules (eg `'react'`)
2. modules from a parent directory (eg `'../foo'`)
3. "sibling" modules from the same or a sibling's directory (eg `'./bar'` or './bar/baz')

For CSS, we use [reactstrap](https://reactstrap.github.io/) and Bootstrap's utility classes as
much as possible before adding custom CSS to a style sheet. Any custom style that can be made
reusable should be named generically and stored in the `ui/css/treeherder-custom-styles.css` file.
