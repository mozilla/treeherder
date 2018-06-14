import userguideApp from '../userguide';

userguideApp.controller('UserguideCtrl', ['$scope',
    function UserguideCtrl($scope) {

        // Used for dynamic startdate, enddate param examples
        const d = new Date();
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const sd = d.getDate() - 2;
        const ed = d.getDate();

        $scope.startDate = y + '-' + m + '-' + sd;
        $scope.endDate = y + '-' + m + '-' + ed;
    },
]);
