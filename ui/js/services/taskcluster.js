'use strict';

treeherder.factory('thTaskcluster', ['$window',
    function ($window) {
        let client = require('taskcluster-client');

        $window.addEventListener("taskcluster-credentials", function ({ detail: credentials }) {
            client.config({ credentals: credentials || {} });
        });

        return {
            client: function () { return client; },
            refreshTimestamps: function (task) {
                // Take a taskcluster task and make all of the timestamps
                // new again. This is pretty much lifted verbatim from
                // mozilla_ci_tools which was used by pulse_actions.
                // We need to do this because action tasks are created with
                // timestamps for expires/created/deadline that are based
                // on the time of the original decision task creation. We must
                // update to the current time, or Taskcluster will reject the
                // task upon creation.
                task.expires = client.fromNow('366 days');
                task.created = client.fromNow(0);
                task.deadline = client.fromNow('1 day');
                _.map(task.payload.artifacts, function (artifact) {
                    artifact.expires = client.fromNow('365 days');
                });
                return task;
            },
        };
    }
]);
