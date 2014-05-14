'use strict';

logViewer.controller('LogviewerCtrl', [
    '$anchorScroll', '$scope', 'ThLog', '$rootScope', '$location', '$http',
    '$timeout', 'ThJobArtifactModel',
    function Logviewer(
        $anchorScroll, $scope, ThLog, $rootScope, $location, $http,
        $timeout, ThJobArtifactModel) {

        var $log = new ThLog("LogviewerCtrl");

        var query_string = $location.search();
        if (query_string.repo !== "") {
            $rootScope.repoName = query_string.repo;
        }
        if (query_string.job_id !== "") {
            $scope.job_id= query_string.job_id;
        }

        $scope.displayedLogPieces = [];

        var isInViewport = function (el, partial) {
            //special bonus for those using jQuery
            if (el instanceof jQuery) {
                el = el[0];
            }

            var rect = el.getBoundingClientRect();
            var offsetHeight = 270;

            if (!partial) {
                return (
                    rect.top >= 270 &&
                    rect.left >= 0 &&
                    rect.bottom <= $(window).height() && /*or  */
                    rect.right <= $(window).height() /*or $(window).width() */
                );
            }

            var height = $(el).height();
            var width = $(el).width();

            return (
                (rect.bottom >= 270 && rect.top <= 270) ||
                (rect.top >= 270 && rect.bottom <= $(window).height()) ||
                (rect.right >= 0 && rect.left <= 0) ||
                (rect.top <= $(window).height() && rect.bottom >= $(window).height()) ||
                (rect.left <= $(window).width() && rect.right >= $(window).width())
            );
        }

        function checkLoadAbove () {
            var topVisible = isInViewport( $('.lv-scroll-extend-above')[0] );

            if (!$scope.displayedStep || !topVisible) return;

            var index = $scope.displayedLogPieces[ 0 ].order;

            // make sure we are not at the first step
            if ( index === 0 ) return;

            // prepending the data will always send us to the scroll position 0. reset that
            $timeout(function () {
                $(window).scrollTop( $('.lv-log-line[order="' + index + '"]').first().offset().top - 270 );
            });

            var step = $scope.artifact.step_data.steps[ index - 1 ];

            $scope.displayedLogPieces = step.logPieces.concat( $scope.displayedLogPieces );

            if(!$scope.$$phase) { $scope.$apply(); }
        }

        function checkLoadBelow () {
            var bottomVisible = isInViewport( $('.lv-scroll-extend-below')[0] );

            if (!$scope.displayedStep || !bottomVisible) return;

            var index = $scope.displayedLogPieces[ $scope.displayedLogPieces.length - 1 ].order;

            // make sure we are not at the last step
            if ( index === $scope.artifact.step_data.steps.length - 1 ) return;

            var step = $scope.artifact.step_data.steps[ index + 1 ];

            $scope.displayedLogPieces = $scope.displayedLogPieces.concat( step.logPieces );

            if(!$scope.$$phase) { $scope.$apply(); }
        }

        // we need to remove any log pieces we can't see
        function pruneUnseenData () {
            var ordersVisibility = [], l;

            for ( var i = 0; l = $scope.artifact.step_data.steps.length, i < l; i++ ) {
                var els = $('.lv-log-line[order="' + i + '"]');
                ordersVisibility[i] = 0;
                els.each(function ( index, el ) {
                    // check if the element is in the viewport, even partially
                    if ( isInViewport( el, true ) ) ordersVisibility[i]++;
                });

                if ( ordersVisibility[i] === 0 ) {
                    for ( var j = 0; j < $scope.displayedLogPieces.length; j++ ) {
                        if ( $scope.displayedLogPieces.order === i ) {
                            $scope.displayedLogPieces = $scope.displayedLogPieces.splice(j, 1);
                        }
                    }
                }
            }

            if(!$scope.$$phase) { $scope.$apply(); }
        }

        $scope.scrollTo = function($event, step, linenumber) {
            $timeout(function () {
                $(window).scrollTop( $('#lv-line-'+linenumber).offset().top - 270 );
            });

            if ( $scope.displayedStep && $scope.displayedStep.order === step.order ) $event.stopPropagation();
        };

        // @@@ it may be possible to do this with the angular date filter?
        $scope.formatTime = function(sec) {
            var h = Math.floor(sec/3600);
            var m = Math.floor(sec%3600/60);
            var s = Math.floor(sec%3600 % 60);
            var secStng = sec.toString();
            var ms = secStng.substr(secStng.indexOf(".")+1, 2);
            return ((h > 0 ? h + "h " : "") + (m > 0 ? m + "m " : "") +
                   (s > 0 ? s + "s " : "") + (ms > 0 ? ms + "ms " : "00ms"));
        };

        $scope.displayTime = function(started, finished) {
            var start = started.substr(started.indexOf(" ")+1, 8);
            var end = finished.substr(finished.indexOf(" ")+1, 8);
            return start + "-" + end;
        };

        $scope.displayLog = function(step) {
            $scope.displayedStep = step;
            $scope.mostVisibleOrder = step.order;

            // start by getting the surrounding log pieces
            var previousStep = $scope.artifact.step_data.steps[ step.order - 1 ] || {logPieces: []};
            var nextStep = $scope.artifact.step_data.steps[ step.order + 1 ] || {logPieces: []};

            $scope.displayedLogPieces = previousStep.logPieces.concat( step.logPieces, nextStep.logPieces );

            // center on our selected steps first log piece
            $timeout(function() {
                $(window).scrollTop( $('.lv-log-line[order="' + step.order + '"]').first().offset().top - 270 );
            });
        };

        $scope.sliceLog = function(data) {
        // split the log into chunks.  Non-error sections are one large
        // chunk separated by \n.  Each error gets its own chunk.

            $scope.artifact.step_data.steps.forEach(function(step) {
                // slice up the raw log and add those pieces to the artifact step.
                step.logPieces = [];
                var offset = step.started_linenumber;
                step.errors.forEach(function(err) {
                    var end = err.linenumber;
                    if (offset !== end) {
                        step.logPieces.push({
                            text: (data.slice(offset, end)).join('\n'),
                            hasError: false,
                            order: step.order
                        });
                    }
                    step.logPieces.push({
                        text: data.slice(end, end+1)[0],
                        hasError: true,
                        order: step.order,
                        errLine: end
                    });
                    offset = end+1;
                });
                step.logPieces.push({
                    text: (data.slice(offset, step.finished_linenumber+1)).join('\n'),
                    hasError: false,
                    order: step.order
                });

            });
        };

        $scope.init = function() {
//            To test with a static log when no log artifacts are available.
//            $http.get('resources/logs/mozilla-inbound_ubuntu64_vm-debug_test-mochitest-other-bm53-tests1-linux-build122.logview.json').
//                success(function(data) {
//                    $scope.artifact = data;
//                    $scope.logurl = data.logurl;
//                    $http.get('resources/logs/mozilla-inbound_ubuntu64_vm-debug_test-mochitest-other-bm53-tests1-linux-build122.txt').
//                        success(function(data) {
//                            $scope.sliceLog(data.split("\n"));
//                        });
//                });
            $(window).scroll(function () {
                checkLoadAbove();
                checkLoadBelow();
                // pruneUnseenData();
            });

            $log.log(ThJobArtifactModel.get_uri());
            ThJobArtifactModel.get_list({job_id: $scope.job_id, name: "Structured Log"})
            .then(function(artifact_list){
                if(artifact_list.length > 0){
                    $scope.artifact = artifact_list[0].blob;
                    return $http.get($scope.artifact.logurl)
                    .success(function(data){
                        $scope.sliceLog(data.split("\n"));
                    });
                }

            });
        };

    }
]);
