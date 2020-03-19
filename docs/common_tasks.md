# Common tasks

## Serving the docs locally

The docs are built using MkDocs, which has a live-reloading development server,
that makes working on the docs locally much easier.

To use this within the Docker environment, run:

```bash
docker-compose run -p 8000:8000 backend mkdocs serve -a 0.0.0.0:8000
```

Or if you would rather not use Docker, instead use poetry,run:

```console
% pip install poetry
% poetry install
% poetry run mkdocs serve
```
**Note-**On Windows you might need to fallback ```python -m venv venv``` or ```virtualenv``` to manage your virtualenv if ```poetry``` does not work for you.

In either case, the docs will then be available at: <http://localhost:8000>

## Updating package.json

- Always use `yarn` to make changes, not `npm`, so that `yarn.lock` remains in sync.
- Add new packages using `yarn add <PACKAGE>` (`yarn.lock` will be automatically updated).
- After changes to `package.json` use `yarn install` to install them and automatically update `yarn.lock`.
- For more details see the [Yarn documentation].

[yarn documentation]: https://yarnpkg.com/en/docs/usage

## Add a new Mercurial repository

To add a new repository, the following steps are needed:

- Append new repository information to the fixtures file located at:
  `treeherder/model/fixtures/repository.json`
- Restart any running Django runserver/Celery processes.

For more information on adding a new GitHub repository, see
[Adding a GitHub repository](submitting_data.md#adding-a-github-repository).

## Debugging Tools

You can use the Python Debugger ([pdb](https://docs.python.org/3.7/library/pdb.html)) in a Docker container.
After starting a local Treeherder instance using [docker-compose](installation.md#server-and-full-stack-development),
in a separate shell type `docker attach backend`. Then set a breakpoint in your file using either `import pdb; pdb.set_trace()`
or `breakpoint()` (for Python v3.7+). The pdb debugger will start in that shell once the breakpoint has been triggered.
For example, it can be triggered via refreshing the browser (localhost) if the view you're on calls an API with a breakpoint on it.
