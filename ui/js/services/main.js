import treeherder from '../treeherder';
import tcJobActionsTemplate from '../../partials/main/tcjobactions.html';

/* Services */
treeherder.factory('thUrl', [
    '$rootScope', 'thServiceDomain',
    function ($rootScope, thServiceDomain) {

        var thUrl = {
            getRootUrl: function (uri) {
                return thServiceDomain + "/api" + uri;
            },
            getProjectUrl: function (uri, repoName) {
                if (_.isUndefined(repoName)) {
                    repoName = $rootScope.repoName;
                }
                return thServiceDomain + "/api/project/" + repoName + uri;
            },
            getProjectJobUrl: function (url, jobId, repoName) {
                var uri = "/jobs/" + jobId + url;
                return thUrl.getProjectUrl(uri, repoName);
            },
            getJobsUrl: function (repo, fromChange, toChange) {
                return "index.html#/jobs?" + _.reduce({
                    repo: repo, fromchange: fromChange, tochange: toChange
                }, function (result, v, k) {
                    if (result.length) result += '&';
                    return result + k + '=' + v;
                }, "");
            },
            getLogViewerUrl: function (job_id, line_number) {
                var rv = "logviewer.html#?job_id=" + job_id + "&repo=" + $rootScope.repoName;
                if (line_number) {
                    rv += "&lineNumber=" + line_number;
                }
                return rv;
            },
        };
        return thUrl;

    }]);

treeherder.factory('thNotify', [
    '$timeout', 'localStorageService',
    function ($timeout, localStorageService) {
        //a growl-like notification system

        var thNotify = {
            // message queue
            notifications: [],

            // Long-term storage for notifications
            storedNotifications: (localStorageService.get('notifications') || []),

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

                var maxNsNotifications = 5;
                var notification = {
                    ...opts,
                    message,
                    severity,
                    created: Date.now()
                };
                thNotify.notifications.unshift(notification);
                thNotify.storedNotifications.unshift(notification);
                thNotify.storedNotifications.splice(40);
                localStorageService.set('notifications', thNotify.storedNotifications);

                if (!opts.sticky) {
                    if (thNotify.notifications.length > maxNsNotifications) {
                        $timeout(thNotify.shift);
                        return;
                    }
                    $timeout(thNotify.shift, 4000, true);
                }
            },

           /*
            * send a message to the notification queue without displaying the notification box
            * @severity can be one of success|info|warning|danger
            */
            record: function (message, severity) {
                const notification = {
                    message,
                    severity,
                    created: Date.now()
                };
                const storedNotifications = thNotify.storedNotifications;

                storedNotifications.unshift(notification);
                localStorageService.set('notifications', storedNotifications);
            },

            /*
             * Delete the first non-sticky element from the notifications queue
             */
            shift: function () {
                for (var i=0; i<thNotify.notifications.length; i++) {
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
                localStorageService.set('notifications', thNotify.storedNotifications);
            }
        };
        return thNotify;

    }]);

treeherder.factory('thPlatformName', [
    'thPlatformMap',
    function (thPlatformMap) {

        return function (name) {
            var platformName = thPlatformMap[name];
            if (_.isUndefined(platformName)) {
                platformName = name;
            }
            return platformName;
        };
    }]);

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
                }
              }
            });
          }
        };
    }]);

treeherder.factory('thExtendProperties', [
    /* Version of _.extend that works with property descriptors */
    function () {
        return function (dest, src) {
            if (dest !== src) {
                for (var key in src) {
                    if (!src.hasOwnProperty(key)) {
                        continue;
                    }
                    var descriptor = Object.getOwnPropertyDescriptor(src, key);
                    if (descriptor && descriptor.get) {
                        Object.defineProperty(dest, key, {
                            get: descriptor.get,
                            set: descriptor.set,
                            enumerable: descriptor.enumerable,
                            configurable: descriptor.configurable
                        });
                    } else {
                        dest[key] = src[key];
                    }
                }
            }
            return dest;
        };
    }]);
