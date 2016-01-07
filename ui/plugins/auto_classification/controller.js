"use strict";

treeherder.controller('ClassificationPluginCtrl', [
    '$scope', '$rootScope', 'ThLog', 'ThFailureLinesModel', 'ThClassifiedFailuresModel',
    'ThMatcherModel', '$q', 'thEvents', 'thTabs', '$timeout', 'thNotify',
    function ClassificationPluginCtrl(
        $scope, $rootScope, ThLog, ThFailureLinesModel, ThClassifiedFailuresModel,
        ThMatcherModel, $q, thEvents, thTabs, $timeout, thNotify) {
        var $log = new ThLog(this.constructor.name);

        $log.debug("error classification plugin initialized");

        var timeoutPromise = null;
        var requestPromise = null;
        $scope.lineSelection = {};
        $scope.manualBugs = {};
        var matchers = null;

        thTabs.tabs.autoClassification.update = function() {
            $scope.jobId = thTabs.tabs.autoClassification.contentId;
            // if there's an ongoing timeout, cancel it
            if (timeoutPromise !== null) {
                $timeout.cancel(timeoutPromise);
            }
            // if there's a ongoing request, abort it
            if (requestPromise !== null) {
                requestPromise.resolve();
            }

            requestPromise = $q.defer();


            var p;
            if (matchers) {
                p = $q(function(resolve) {resolve(matchers);});
            } else {
                p = ThMatcherModel.get_list();
            }

            thTabs.tabs.autoClassification.is_loading = true;
            p.then(function(matchers_list) {
                matchers = matchers_list;
                return ThFailureLinesModel.get_list($scope.jobId, {timeout: requestPromise});
            })
                .then(function (failureLines) {
                    $scope.failureLinesLoaded = failureLines.length > 0;
                    if (!$scope.failureLinesLoaded) {
                        timeoutPromise = $timeout(thTabs.tabs.autoClassification.update, 5000);
                    } else {
                        buildFailureLineOptions(failureLines);
                    }
                    $scope.failureLines = failureLines;
                })
                .finally(function() {
                    thTabs.tabs.autoClassification.is_loading = false;
                });
        };

        var buildFailureLineOptions = function(failureLines) {
            _.forEach(failureLines, function(line) {
                line.ui = {};

                // used for the selection radio buttons
                line.ui.options = [];
                // the classified_failure specified as "best" (if any)
                var best;

                var matchersById = {};
                _.forEach(matchers,
                          function(matcher) {
                              matchersById[matcher.id] = matcher;
                          });

                var matchesByClassifiedFailure = {};

                function getClassificationMatches(cf_id) {
                    return _.map(matchesByClassifiedFailure[cf_id],
                                 function(match) {
                                     return {
                                         matcher: matchersById[match.matcher],
                                         score: match.score
                                     };
                                 });
                }

                _.forEach(line.matches,
                          function(match) {
                              if (!matchesByClassifiedFailure[match.classified_failure]) {
                                  matchesByClassifiedFailure[match.classified_failure] = [];
                              }
                              matchesByClassifiedFailure[match.classified_failure].push(match);
                          });

                // collect all the classified_failures.  But skip
                // ones with a null bug.  classified_failures with
                // null bugs have no distinguishing features to make
                // them relevant.
                // If the "best" one has a null bug we will add
                // that in later.
                var classifiedBugs = {};
                _.forEach(line.classified_failures, function(cf) {
                    if (cf.bug_number !== null) {
                        var bug_summary = cf.bug ? cf.bug.summary : "";

                        line.ui.options.push({id: cf.id,
                                              bug_number: cf.bug_number,
                                              bug_summary: bug_summary,
                                              type: "classified_failure",
                                              matches: getClassificationMatches(cf.id),
                                             });
                    }
                    classifiedBugs[cf.bug_number] = true;
                });

                // set the best classified_failure
                if (line.best_classification) {
                    best = _.find(line.ui.options,
                                  {id: line.best_classification});

                    if (best) {
                        best.is_best = true;
                        // Remove the best match so we can add it at the start of the
                        // list later
                        line.ui.options = _.filter(line.ui.options,
                                                   function(item) {
                                                       return item.id !== best.id;
                                                   });
                    } else {
                        // The best classification didn't have a bug number so it needs a
                        // new entry
                        best = {id: line.best_classification,
                                bug_number: null,
                                bug_summary: "",
                                type: "classified_failure",
                                matches: getClassificationMatches(line.best_classification)
                               };
                    }
                    line.ui.options = [best].concat(line.ui.options);
                    line.ui.best = best;
                }

                // add in unstructured_bugs as options as well
                _.forEach(line.unstructured_bugs, function(bug) {
                    // adding a prefix to the bug id because,
                    // theoretically, however unlikely, it could
                    // conflict with a classified_failure id.
                    if (!classifiedBugs.hasOwnProperty(bug.id)) {
                        var ubid = "ub-" + bug.id;
                        line.ui.options.push({id: ubid,
                                              bug_number: bug.id,
                                              bug_summary: bug.summary,
                                              type: "unstructured_bug",
                                              matches: null});
                    }
                });

                if (!best || (best && best.bug_number)) {
                    // add a "manual bug" option
                    line.ui.options.push({
                        id: "manual",
                        type: "unstructured_bug",
                        bug_number: null,
                        matches: null
                    });
                }
                line.ui.options.push({
                    id: "ignore",
                    type: "ignore",
                    bug_number: 0,
                    matches: null
                });

                _.forEach(line.ui.options, function(option) {
                    option.icon_type = option.is_best ? "autoclassified" : 'none';
                });

                // choose first in list as lineSelection
                line.ui.selectedOption = 0;
            });
        };

        /**
         * A line has been selected as ignored if its bug_number is set to 0.
         */
        $scope.isLineIgnored = function(line) {
            return line.ui.options[line.ui.selectedOption].bug_number === 0 ||
                   line.ui.best.bug_number === 0;
        };

        /**
         * A bug number can either be a real bug id in bugzilla, or 0.
         * 0 indicates that the line has been ignored with regard to
         * the error classification.
         */
        var isValidBugNumber = function(bug_number) {
            return bug_number >= 0;
        };

        $scope.canSave = function(line) {
            return (isValidBugNumber(line.ui.options[line.ui.selectedOption].bug_number) ||
                    $scope.manualBugs[line.id]);
        };

        $scope.canSaveAll = function() {
            return (_.any($scope.failureLines, function(line) {return !line.best_is_verified;}) &&
                    _.every($scope.failureLines, function(line) {return $scope.canSave(line);}));
        };

        $scope.getSaveButtonText = function(line) {
            if (!line.ui ||
                line.best_classification === line.ui.options[line.ui.selectedOption].id) {
                return "Verify";
            } else if ($scope.isLineIgnored(line)) {
                return "Save";
            } else if (line.best_classification) {
                return "Override";
            } else {
                return "Create";
            }
        };

        $scope.save = function(line) {
            var selected = line.ui.options[line.ui.selectedOption];
            var bug_number = isValidBugNumber(selected.bug_number) ? selected.bug_number : $scope.manualBugs[line.id];

            if (_.parseInt(bug_number) >= 0) {

                switch (selected.type) {
                    case "classified_failure":
                        verifyClassifiedFailure(line, selected, bug_number);
                        break;
                    case "unstructured_bug":
                    case "ignore":
                        verifyUnstructuredBug(line, bug_number);
                        break;
                }
            } else {
                thNotify.send("Invalid bug number: " + bug_number, "danger", true);
            }

        };

        $scope.saveAll = function() {
            var failureLines = $scope.failureLines;

            var byType = _.partition(
                failureLines,
                function(line) {
                    return line.ui.options[line.ui.selectedOption].type === "classified_failure";
                });

            var autoclassified = byType[0];
            var unstructured = byType[1];

            var byHasBug = _.partition(
                autoclassified,
                function(line) {return !!line.ui.options[line.ui.selectedOption].bug_number;});

            var hasBug = byHasBug[0];
            var toCreateBug = byHasBug[1];

            var updateClassifications = _.map(
                toCreateBug,
                function(line) {
                    return {id: line.ui.options[line.ui.selectedOption].id,
                            bug_number: $scope.manualBugs[line.id]};
                }
            );

            var newClassifications = _.map(
                unstructured,
                function(line) {
                    var option = line.ui.options[line.ui.selectedOption];
                    var bug_number = isValidBugNumber(option.bug_number) ? option.bug_number : $scope.manualBugs[line.id];
                    return {bug_number: bug_number};
                }
            );

            // Map of failure line id to best classified failure id
            var bestClassifications = _.map(
                hasBug,
                function (line) {
                    return {
                        id: line.id,
                        best_classification: line.ui.options[line.ui.selectedOption].id
                    };
                });

            function updateBestClassifications(lines, classifiedFailures) {
                bestClassifications = _.union(
                    bestClassifications,
                    _.map(_.zip(lines, classifiedFailures),
                          function(item) {
                              return {id: item[0].id,
                                      best_classification: item[1].id};
                          }));
            }

            ThClassifiedFailuresModel.createMany(newClassifications)
                .then(function(resp) {
                    if (resp) {
                        updateBestClassifications(unstructured, resp.data);
                    }
                })
                .then(function() {
                    return ThClassifiedFailuresModel.updateMany(updateClassifications);
                })
                .then(function(resp) {
                    if (resp) {
                        updateBestClassifications(toCreateBug, resp.data);
                    }
                })
                .then(function() {return ThFailureLinesModel.verifyMany(bestClassifications);})
                .then(function() {thNotify.send("Classifications saved", "success");})
                .catch(function(err) {
                    var msg = "Error saving classifications:\n ";
                    if (err.stack) {
                        msg += err + err.stack;
                    } else {
                        msg += err.statusText + " - " + err.data.detail;
                    }
                    thNotify.send(msg, "danger");
                })
                .then(function() {thTabs.tabs.autoClassification.update();});
        };

        var verifyLine = function(line, cf) {
            ThFailureLinesModel.verify(line.id, cf.id)
                .then(function (response) {
                    thNotify.send("Autoclassification has been verified", "success");
                }, function (errorResp) {
                    thNotify.send("Error verifying autoclassification", "danger");
                })
                .finally(function () {
                    thTabs.tabs.autoClassification.update();
                });

        };

        var verifyClassifiedFailure = function(line, cf, bug_number) {
            if (cf.bug_number !== bug_number) {
                // need to update the bug number on it
                var model = new ThClassifiedFailuresModel(cf);
                model.update(bug_number).then(
                    function(updated_cf_resp) {
                        // got the updated cf, now need to verify the line
                        verifyLine(line, updated_cf_resp.data);
                    },
                    function(error) {
                        thNotify.send(error, "danger", true);
                    });
            } else {
                verifyLine(line, cf);
            }
        };

        var verifyUnstructuredBug = function(line, bug_number) {
            ThClassifiedFailuresModel.create(bug_number)
                .then(function(resp) {
                    // got the updated cf, now need to verify the line
                    verifyLine(line, resp.data);
                },
                      function(error) {
                          thNotify.send(error, "danger", true);
                      });
        };

        $rootScope.$on(thEvents.saveAllAutoclassifications, function(event) {
            if ($scope.canSaveAll()) {
                $scope.saveAll();
            }
        });
    }
]);
