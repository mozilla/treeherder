import _ from 'lodash';

import treeherder from '../treeherder';
import tcJobActionsTemplate from '../../partials/main/tcjobactions.html';
import { thPlatformMap } from '../constants';


/* Services */
treeherder.factory('thNotify', [
    '$timeout',
    function ($timeout) {
        // a growl-like notification system

        const thNotify = {
            // message queue
            notifications: [],

            // Long-term storage for notifications
            storedNotifications: JSON.parse(localStorage.getItem('notifications') || '[]'),

            // Callback for any updates.  Listening to window for 'storage'
            // events won't work for this because those events are only fired
            // for storage events made in OTHER windows/tabs.  Not the current
            // one.  Default to dummy function.
            // TODO: We should be able to remove this once this service is
            // converted to a class for direct usage in ReactJS.
            changeCallback: () => {},

            /*
             * send a message to the notification queue
             * @severity can be one of success|info|warning|danger
             * @opts is an object with up to three entries:
             *   sticky -- Keeps notification visible until cleared if true
             *   linkText -- Text to display as a link if exists
             *   url -- Location the link should point to if exists
             */
            send: function (message, severity, opts) {
                if (opts !== undefined && !_.isPlainObject(opts)) {
                    throw new Error('Must pass an object as last argument to thNotify.send!');
                }
                opts = opts || {};
                severity = severity || 'info';

                const maxNsNotifications = 5;
                const notification = {
                    ...opts,
                    message,
                    severity,
                    created: Date.now(),
                };
                thNotify.notifications.unshift(notification);
                thNotify.storedNotifications.unshift(notification);
                thNotify.storedNotifications.splice(40);
                localStorage.setItem('notifications', JSON.stringify(thNotify.storedNotifications));
                thNotify.changeCallback(thNotify.storedNotifications);

                if (!opts.sticky) {
                    if (thNotify.notifications.length > maxNsNotifications) {
                        $timeout(thNotify.shift);
                        return;
                    }
                    $timeout(thNotify.shift, 4000, true);
                }
            },

            /*
             * Delete the first non-sticky element from the notifications queue
             */
            shift: function () {
                for (let i = 0; i < thNotify.notifications.length; i++) {
                    if (!thNotify.notifications[i].sticky) {
                        thNotify.remove(i);
                        return;
                    }
                }
            },
            /*
             * remove an arbitrary element from the notifications queue
             */
            remove: function (index) {
                thNotify.notifications.splice(index, 1);
            },

            /*
             * Clear the list of stored notifications
             */
            clear: function () {
                thNotify.storedNotifications = [];
                localStorage.setItem('notifications', thNotify.storedNotifications);
                thNotify.changeCallback(thNotify.storedNotifications);
            },
            setChangeCallback: function (cb) {
              thNotify.changeCallback = cb;
            },
        };
        return thNotify;

    }]);

treeherder.factory('thPlatformName', () => (name) => {
    let platformName = thPlatformMap[name];
    if (platformName === undefined) {
        platformName = name;
    }
    return platformName;
});

// The Custom Actions modal is accessible from both the PushActionMenu and the
// job-details-actionbar.  So leave this as Angular for now, till we
// migrate job-details-actionbar to React.
treeherder.factory('customPushActions', [
    '$uibModal',
    function ($uibModal) {
        return {
          open(repoName, pushId) {
            $uibModal.open({
              template: tcJobActionsTemplate,
              controller: 'TCJobActionsCtrl',
              size: 'lg',
              resolve: {
                job: () => null,
                repoName: function () {
                  return repoName;
                },
                resultsetId: function () {
                  return pushId;
                },
              },
            });
          },
        };
    }]);
