UI development
==============

It's possible to work on the UI without setting up the Vagrant VM.

To get started:

* Clone the [treeherder repo] from GitHub.
* Install [Node.js] and [Yarn] (see [package.json] for known compatible versions, listed under `engines`).
* Run ``yarn install`` to install all dependencies.

Running the standalone development server
-----------------------------------------

The default development server runs the unminified UI and fetches data from the
production site. You do not need to set up the Vagrant VM unless making backend changes.

* Start the development server by running:

  ```bash
  $ yarn start
  ```

* The server will perform an initial build and then watch for new changes. Once the server is running, you can navigate to: <http://localhost:5000> to see the UI.

  To run the unminified UI with data from the staging site instead of the production site, type:

  ```bash
  $ yarn start:stage
  ```

  If you need to serve data from another domain, type:

  ```bash
  $ BACKEND_DOMAIN=<url> yarn start
  ```

  This will run the unminified UI using ``<url>`` as the service domain.

Running the unminified UI with Vagrant
--------------------------------------
You may also run the unminified UI using the full treeherder Vagrant project.

First, make sure you have set up Vagrant and ingested some data as described in the main
installation instructions, then follow these steps:

* SSH to the Vagrant machine and start the treeherder service, like this:

  ```bash
  vagrant ~/treeherder$ ./manage.py runserver
  ```

* Then, open a new terminal window and SSH to the Vagrant machine again. Run the
  following:

  ```bash
  vagrant ~/treeherder$ yarn start:local
  ```

* The server will perform an initial build and then watch for new changes. Once the server is running, you can navigate to: <http://localhost:5000> to see the UI.

Building the minified UI with Vagrant
-------------------------------------
If you would like to view the minified production version of the UI with Vagrant, follow these steps:

* SSH to the Vagrant machine and start the treeherder service:

  ```bash
  vagrant ~/treeherder$ ./manage.py runserver
  ```

* Then run the build task (either outside or inside of the Vagrant machine):

  ```bash
  $ yarn build
  ```

Once the build is complete, the minified version of the UI will now be accessible at
<http://localhost:8000> (NB: port 8000, unlike above).

Validating JavaScript
---------------------

We run our JavaScript code in the frontend through [eslint] to ensure
that new code has a consistent style and doesn't suffer from common
errors. Eslint will run automatically when you build the JavaScript code
or run the  development server. A production build will fail if your code
does not match the style requirements.

To run eslint by itself, you may run the lint task:

```bash
$ yarn lint
```

Running the unit tests
----------------------

The unit tests for the UI are run with [Karma] and [Jasmine]. React components are tested with [enzyme]. 

To run the tests:

* If you haven't already done so, install local dependencies by running ``yarn install`` from the project root.
* Then run ``yarn test`` to execute the tests.

While working on the frontend, you may wish to watch JavaScript files and re-run tests
automatically when files change. To do this, you may run the following command:

```bash
$ yarn test:watch
```

The tests will perform an initial run and then re-execute each time a project file is changed.

[Karma]: http://karma-runner.github.io/0.8/config/configuration-file.html
[treeherder repo]: https://github.com/mozilla/treeherder
[Node.js]: https://nodejs.org/en/download/current/
[Yarn]: https://yarnpkg.com/en/docs/install
[package.json]: https://github.com/mozilla/treeherder/blob/master/package.json
[eslint]: https://eslint.org
[Jasmine]: https://jasmine.github.io/
[enzyme]: http://airbnb.io/enzyme/
