import treeherder from '../../treeherder';
import thNotificationsBoxTemplate from '../../../partials/main/thNotificationsBox.html';

treeherder.directive('thNotificationBox', [
    'thNotify',
    function (thNotify) {
        return {
            restrict: 'E',
            template: thNotificationsBoxTemplate,
            link: function (scope) {
                scope.notifier = thNotify;
                scope.alert_class_prefix = 'alert-';
            },
        };
    }]);
