# Code Style

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
