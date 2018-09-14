import treeherder from '../../treeherder';
import thNotificationsBoxTemplate from '../../../partials/main/thNotificationsBox.html';

treeherder.directive('stopPropagationOnLeftClick', [
    function () {
        return {
            restrict: 'A',
            link: function (scope, element) {
                element.on('click', function (event) {
                    if (event.which === 1) {
                        event.stopPropagation();
                    }
                });
            },
        };
    },
]);

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
