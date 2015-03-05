/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

treeherder.factory('ThOptionCollectionModel', [
    '$http', '$log', 'thUrl',
    function($http, $log, thUrl) {
      var get_list = function(options) {
        options = options || {};
        // a static method to retrieve a list of ThOptionCollectionModel
        var query_string = $.param(options);
        return $http.get(thUrl.getRootUrl("/optioncollectionhash/") + "?" +
                         query_string);
      };

      return {
        get_list: get_list
      };
    }
]);
