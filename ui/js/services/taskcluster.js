'use strict';

import * as taskcluster from 'taskcluster-client-web';

treeherder.factory('thTaskcluster', ['$rootScope', 'localStorageService',
    function ($rootScope, localStorageService) {
        $rootScope.$on("LocalStorageModule.notification.setitem", function () {
            taskcluster.config({
                credentials: localStorageService.get('taskcluster.credentials') || {},
            });
        });

        return {
            client: function () { return taskcluster; },
            refreshTimestamps: function (task) {
                // Take a taskcluster task and make all of the timestamps
                // new again. This is pretty much lifted verbatim from
                // mozilla_ci_tools which was used by pulse_actions.
                // We need to do this because action tasks are created with
                // timestamps for expires/created/deadline that are based
                // on the time of the original decision task creation. We must
                // update to the current time, or Taskcluster will reject the
                // task upon creation.
                task.expires = taskcluster.fromNow('366 days');
                task.created = taskcluster.fromNow(0);
                task.deadline = taskcluster.fromNow('1 day');
                _.map(task.payload.artifacts, function (artifact) {
                    artifact.expires = taskcluster.fromNow('365 days');
                });
                return task;
            },
        };
    }
]);
