import treeherder from '../../js/treeherder';
import intermittentTemplate from '../../partials/main/intermittent.html';

treeherder.controller('BugsPluginCtrl', [
    '$scope', '$rootScope',
    'thPinboard', 'thEvents',
    '$uibModal',
    function BugsPluginCtrl(
        $scope, $rootScope,
        thPinboard, thEvents, $uibModal) {

        $scope.fileBug = function (index) {
            const summary = $scope.suggestions[index].search;
            const allFailures = [];
            const crashSignatures = [];
            const crashRegex = /application crashed \[@ (.+)\]$/g;
            const crash = summary.match(crashRegex);
            if (crash) {
                const signature = crash[0].split("application crashed ")[1];
                crashSignatures.push(signature);
            }

            for (let i=0; i<$scope.suggestions.length; i++) {
                allFailures.push($scope.suggestions[i].search.split(" | "));
            }

            const modalInstance = $uibModal.open({
                template: intermittentTemplate,
                controller: 'BugFilerCtrl',
                size: 'lg',
                openedClass: "filer-open",
                resolve: {
                    summary: function () {
                        return summary;
                    },
                    search_terms: function () {
                        return $scope.suggestions[index].search_terms;
                    },
                    fullLog: function () {
                        return $scope.job_log_urls[0].url;
                    },
                    parsedLog: function () {
                        return $scope.lvFullUrl;
                    },
                    reftest: function () {
                        return $scope.isReftest() ? $scope.reftestUrl : "";
                    },
                    selectedJob: function () {
                        return $scope.selectedJob;
                    },
                    allFailures: function () {
                        return allFailures;
                    },
                    crashSignatures: function () {
                        return crashSignatures;
                    },
                    successCallback: function () {
                        return function (data) {
                            // Auto-classify this failure now that the bug has been filed
                            // and we have a bug number
                            thPinboard.addBug({ id: data.success });
                            $rootScope.$evalAsync(
                                $rootScope.$emit(
                                    thEvents.saveClassification));
                            // Open the newly filed bug in a new tab or window for further editing
                            window.open("https://bugzilla.mozilla.org/show_bug.cgi?id=" + data.success);
                        };
                    }
                }
            });
            thPinboard.pinJob($scope.selectedJob);

            modalInstance.opened.then(function () {
                window.setTimeout(() => modalInstance.initiate(), 0);
            });
        };
    }
]);
