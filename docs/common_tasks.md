# Common tasks

## Serving the docs locally

The docs are built using MkDocs, which has a live-reloading development server,
that makes working on the docs locally much easier.

```console
% pip install poetry
% poetry run mkdocs serve
```

<!-- prettier-ignore -->
!!! note
    On Windows you might need to fallback ```python -m venv venv``` or ```virtualenv``` to manage your virtualenv if ```poetry``` does not work for you.

The docs will then be available at: <http://localhost:8000>

## Updating package.json

- Always use `yarn` to make changes, not `npm`, so that `yarn.lock` remains in sync.
- Add new packages using `yarn add <PACKAGE>` (`yarn.lock` will be automatically updated).
- After changes to `package.json` use `yarn install` to install them and automatically update `yarn.lock`.
- For more details see the [Yarn documentation].

[yarn documentation]: https://yarnpkg.com/en/docs/usage

## Debugging Tools

You can use the Python Debugger ([pdb](https://docs.python.org/3.10/library/pdb.html)) in a Docker container.
After starting a local Treeherder instance using [docker-compose](installation.md#server-and-full-stack-development),
in a separate shell type `docker attach backend`. Then set a breakpoint in your file using either `import pdb; pdb.set_trace()`
or `breakpoint()`. The pdb debugger will start in that shell once the breakpoint has been triggered.
For example, it can be triggered via refreshing the browser (localhost) if the view you're on calls an API with a breakpoint on it.
