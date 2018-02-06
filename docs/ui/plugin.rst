Writing a Plugin
================

When a job is selected, a bottom tabbed panel is activated which shows details
of that job.  You can add your own tab to that panel in the form of a
``plugin``.

The existing ``Jobs Detail`` tab is, itself, a plugin.  So it is a good example
to follow.  See ``ui/plugins/jobdetail``.

To create a new plugin the following steps are required:

    * Create your plugin folder
    * Create a ``controller`` in your plugin folder
    * Create a ``partial`` HTML file in your plugin folder
    * Register the ``controller``
    * Register the ``partial``


Create your plugin folder
-------------------------

Your folder can have whatever name you choose, but it should reside beneath
``app/plugins``.  For example: ``app/plugins/jobfoo``.


Create a controller
-------------------

The most basic of controllers would look like this::

    treeherder.controller('JobFooPluginCtrl',
        function JobFooPluginCtrl($scope) {

            $scope.$watch('selectedJob', function(newValue, oldValue) {
                // preferred way to get access to the selected job
                if (newValue) {
                    $scope.job = newValue;
                }
            }, true);
        }
    );

This controller just watches the value of ``selectedJob`` to see when it gets
a value.  ``selectedJob`` is set by the ui when a job is... well... selected.


Create a partial
----------------

The ``partial`` is the portion of HTML that will be displayed in your plugin's
tab.  A very simple partial would look like this::

    <div ng-controller="JobFooPluginCtrl">
        <p>I pitty the foo that don't like job_guid: {{ job.job_guid }}</p>
    </div>


Register the controller
-----------------------

Due to a limitation of jqlite, you must register your ``controller.js`` in
the main application's ``index.html`` file.  You can see at the end of the file
that many ``.js`` files are registered.  Simply add yours to the list::

    <script src="plugins/jobfoo/controller.js"></script>


Register the partial
--------------------

The plugins controller needs to be told to use your plugin.  So edit the file:
``app/plugins/controller.js`` and add an entry to the ``tabs`` array with the
information about your plugin::

    $scope.tabs = [
        {
            title: "Jobs Detail",
            content: "plugins/jobdetail/main.html",
            active: true
        },
        {
            title: "Jobs Foo",
            content: "plugins/jobfoo/main.html"
        }
    ];

It may be obvious, but ``title`` is the title of the tab to display.  And
``content`` is the path to your partial.


Profit
------

That's it!  Reload your page, and you should now have a tab to your plugin!
Rejoice in the profit!