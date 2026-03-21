# Code Style

## UI

We use [Prettier](https://prettier.io) for JS/JSX formatting and [Biome](https://biomejs.dev)
for linting. To run the linter, use `pnpm lint` (or `pnpm lint --write` to auto-fix). See
Validating Javascript in the [Installation section](installation.md#validating-javascript).

Prettier is also used to format JSON/CSS/HTML/Markdown/YAML. To manually check formatting
run `pnpm format:check`, or to apply formatting fixes run `pnpm format`.

We recommend that you
[add Prettier to your editor/IDE](https://prettier.io/docs/en/editors.html)
and enable "format on save" for the most seamless development workflow.

Imports in JS/JSX must be ordered like so (with newlines between each group):

1. external modules (eg `'react'`)
2. modules from a parent directory (eg `'../foo'`)
3. "sibling" modules from the same or a sibling's directory (eg `'./bar'` or './bar/baz')

For CSS, we use [react-bootstrap](https://react-bootstrap.github.io/) and Bootstrap 5's utility
classes as much as possible before adding custom CSS to a style sheet. Any custom style that can be
made reusable should be named generically and stored in the `ui/css/treeherder-custom-styles.css` file.
