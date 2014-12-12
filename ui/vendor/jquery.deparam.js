/**
 * jQuery.deparam - The oposite of jQuery param. Creates an object of query string parameters.
 *
 * Credits for the idea and Regex:
 * http://stevenbenner.com/2010/03/javascript-regex-trick-parse-a-query-string-into-an-object/
 *
 * :camd - added support for multiple values of the same param
*/
(function($){
  $.deparam = $.deparam || function(uri){
    if(uri === undefined){
      uri = window.location.search;
    }
    var queryString = {};
    uri.replace(
      new RegExp(
        "([^?=&]+)(=([^&#]*))?", "g"),
        function($0, $1, $2, $3) {
            if (queryString.hasOwnProperty($1)) {
                if (!$.isArray(queryString[$1])) {
                    queryString[$1] = [queryString[$1]]
                }
                queryString[$1].push($3);
            } else {
                queryString[$1] = $3;
            }
        }
      );
      return queryString;
    };
})(jQuery);