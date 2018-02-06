treeherderApp.controller('NotificationCtrl', [
    '$scope', 'thNotify',
    function NotificationCtrl($scope, thNotify) {
        $scope.notifications = () => thNotify.storedNotifications;
        $scope.clear = () => thNotify.clear();
    }
]);
