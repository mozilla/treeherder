# Common tasks

## Serving the docs locally

The docs are built using MkDocs, which has a live-reloading development server,
that makes working on the docs locally much easier.

To use this within the Docker environment, run:

```bash
docker-compose run backend mkdocs serve
```

Or if you would rather not use Docker, instead activate a virtualenv on the host
machine, and from the root of the Treeherder repo, run:

```bash
> pip install -r requirements/docs.txt
> mkdocs serve
```

In either case, the docs will then be available at: <http://127.0.0.1:8000>

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
