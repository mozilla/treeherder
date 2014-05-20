'use strict';

treeherder.factory('ThLogSliceModel', [
    '$http', '$q', '$timeout', 'ThLog', 'thUrl',
    function($http, $q, $timeout, ThLog, thUrl) {

    // ThLogSliceModel is the js counterpart of logslice

    var ThLogSliceModel = function(data) {
        // creates a new instance of ThLogSliceModel
        // using the provided properties
        angular.extend(this, data);
    };

    ThLogSliceModel.LINE_BUFFER_SIZE = 1000;
    ThLogSliceModel.LINE_BUFFER = [];

    ThLogSliceModel.get_uri = function(){return thUrl.getProjectUrl("/logslice/");};

    ThLogSliceModel.get_line_range = function(options, config) {
        this.findInBuffer = function (options) {
            if ( this.LINE_BUFFER.length === 0 ) return false;

            var firstLineInBuffer = this.LINE_BUFFER[0].index;
            var lastLineInBuffer = this.LINE_BUFFER[ this.LINE_BUFFER.length - 1 ].index;
        };

        this.insertIntoBuffer = function (res) {
            // console.warn("insertIntoBuffer Not Implemented");
        };

        config = config || {};
        var timeout = config.timeout || null;
        var found = this.findInBuffer(options);
        var self = this;

        if ( found ) {
            var deferred = $q.defer();

            $timeout(function () {
                deferred.resolve(found);
            });

            return deferred.promise();
        }

        return $http.get(ThLogSliceModel.get_uri(),{
            params: options,
            timeout: timeout
        }).then(function (res) {
            self.insertIntoBuffer(res.data); 

            return res.data;
        });
    };

    return ThLogSliceModel;
}]);
