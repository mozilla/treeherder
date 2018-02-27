import userguideApp from '../userguide';

userguideApp.controller('UserguideCtrl', ['$scope',
    function UserguideCtrl($scope) {

        // Used for dynamic startdate, enddate param examples
        let d = new Date();
        let y = d.getFullYear();
        let m = d.getMonth() + 1;
        let sd = d.getDate() - 2;
        let ed = d.getDate();

        $scope.startDate = y + '-' + m + '-' + sd;
        $scope.endDate = y + '-' + m + '-' + ed;
    }
]);
