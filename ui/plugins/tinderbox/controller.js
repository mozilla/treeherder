"use strict";

treeherder.controller('TinderboxPluginCtrl',
    function TinderboxPluginCtrl($scope, $rootScope, $log) {
        $log.log("Tinderbox plugin initialized");
        $scope.$watch('artifacts', function(newValue, oldValue){
            $scope.tinderbox_lines = [];
            // ``artifacts`` is set as a result of a promise, so we must have
            // the watch have ``true`` as the last param to watch the value,
            // not just the reference.  We also must check for ``blob`` in ``Job Info``
            // because ``Job Info`` can exist without the blob as the promise is
            // fulfilled.
            if (newValue && newValue.hasOwnProperty('Job Info') && newValue['Job Info'].hasOwnProperty('blob')){
                $scope.tinderbox_lines =  newValue['Job Info'].blob.tinderbox_printlines;
            }
        }, true);

    }
);
