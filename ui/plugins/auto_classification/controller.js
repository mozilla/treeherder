"use strict";

var isHelpfulLine = function(lineData) {
    lineData = lineData.replace(/\s*(.*)\s*/, "$1");

    var blacklist = {
        'automation.py': true,
        'remoteautomation.py': true,
        'Shutdown': true,
        'undefined': true,
        'Main app process exited normally': true,
        'Traceback (most recent call last):': true,
        'Return code: 0': true,
        'Return code: 1': true,
        'Return code: 2': true,
        'Return code: 9': true,
        'Return code: 10': true,
        'Exiting 1': true,
        'Exiting 9': true,
        'CrashingThread(void *)': true,
        'libSystem.B.dylib + 0xd7a': true,
        'linux-gate.so + 0x424': true,
        'TypeError: content is null': true,
        'leakcheck': true,
        'ImportError: No module named pygtk': true,
        '# TBPL FAILURE #': true
    };

    return lineData.length > 4 && !blacklist.hasOwnProperty(lineData);
};

treeherder.factory('thStringOverlap', function() {
    return function(str1, str2) {
        // Get a measure of the similarity of two strings by a simple process
        // of tokenizing and then computing the ratio of the tokens in common to
        // the total tokens

        var tokens = [str1, str2]
                .map(function (str) {
                    // Replace paths like /foo/bar/baz.html with just the filename baz.html
                    return str.replace(/[^\s]+\/([^\s]+)\s/,
                                       function(m, p1) {
                                           return " " + p1 + " ";
                                       });
                })
                .map(function (str) {
                    // Split into tokens on whitespace / and |
                    return str.split(/[\s\/\|]+/).filter(function(x) {return x !== "";});
                });

        if (tokens[0].length === 0 || tokens[1].length === 0) {
            return 0;
        }

        var tokenCounts = tokens.map(function(tokens) {
            return _.countBy(tokens, function(x) {return x;});
        });

        var overlap = Object.keys(tokenCounts[0])
                .reduce(function(overlap, x) {
                    if (tokenCounts[1].hasOwnProperty(x)) {
                        overlap += 2 * Math.min(tokenCounts[0][x], tokenCounts[1][x]);
                    }
                    return overlap;
                }, 0);

        return overlap / (tokens[0].length + tokens[1].length);

    };
});

treeherder.factory('ThClassificationOption', ['thExtendProperties',
    function(thExtendProperties) {
        var ThClassificationOption = function(type, id, bugNumber, bugSummary, bugResolution, matches) {
            thExtendProperties(this, {
                type: type,
                id: id,
                bugNumber: bugNumber || null,
                bugSummary: bugSummary || null,
                bugResolution: bugResolution || null,
                hasBug: bugNumber ? true : false, // Did the option have a bug when first created
                matches: matches || null,
                always: false, // For type = 'ignore' ignore just for this job or
                               // also for future cases where the same line is matched
                isBest: false,
                get icon() {
                    return this.isBest ? "autoclassified" : 'none';
                }
            });
        };
        return ThClassificationOption;
    }
]);

treeherder.factory('ThStructuredLinePersist', ['$q',
                                               '$rootScope',
                                               'thExtendProperties',
                                               'thValidBugNumber',
                                               'thNotify',
                                               'thTabs',
                                               'ThFailureLinesModel',
                                               'ThClassifiedFailuresModel',
                                               'thEvents',
    function($q, $rootScope, thExtendProperties, thValidBugNumber, thNotify, thTabs,
             ThFailureLinesModel, ThClassifiedFailuresModel, thEvents) {
        /*
         When saving a structured line, we need to account for the following cases:

         * An autoclassified failure with an existing bug number is selected.
           In this case we set the best classification of the failure line to
           that classification.

         * An autoclassified failure with no existing bug number is selected.
           In that case we first update the classified failure to set the bug number
           and then set the best classification of the failure line to that classification

         * An unstructured bug is selected.
           In that case we first create a new classified failure for the bug (or get the id of
           an existing one), and then set the best classification to that classification

         * A new bug number is manually entered
           This works just like selecting a unstructured bug

         * The line is to be ignored now and in the future
           This works just like selecting an autoclassified failure, with bug number 0.
           In practice we use the same codepath as for an unstructured bug as this allows
           providing the bug number (0) rather than the classified failure id as input.

         * The line is ignored this time only
           In this case we set the best classification of the failure line to null and
           verify the failure

         */

        var ThStructuredLinePersist = function() {};

        var verifyLine = function(line, cf) {
            return ThFailureLinesModel.verify(line.id, cf ? cf.id : null);
        };

        var updateClassifiedFailure = function(line) {
            var model = new ThClassifiedFailuresModel({id: line.classifiedFailureId});
            return model.update(line.bugNumber).then(
                    function(updatedCfResponse) {
                        // got the updated cf, now need to verify the line
                        verifyLine(line, updatedCfResponse.data);
                    },
                    function(error) {
                        thNotify.send(error, "danger", true);
                    });
        };

        var createClassifiedFailure = function(line) {
            return ThClassifiedFailuresModel.create(line.bugNumber)
                .then(function(resp) {
                    verifyLine(line, resp.data);
                },
                      function(error) {
                          thNotify.send(error, "danger", true);
                      });
        };

        var selectClassifiedFailure = function(line) {
            verifyLine(line, {"id": line.classifiedFailureId});
        };

        var ignoreFailureTemporary = function(line) {
            verifyLine(line, null);
        };


        var updateFunc = function(line) {
            var options = {"Update": updateClassifiedFailure,
                           "Ignore": ignoreFailureTemporary,
                           "Create": createClassifiedFailure,
                           "Select": selectClassifiedFailure};
            return options[line.updateType];
        };

        var persistInterface = {
            save: function(line) {
                if (line.bugNumber && !thValidBugNumber(line.bugNumber)) {
                    thNotify.send("Invalid bug number: " + line.bugNumber, "danger", true);
                    return;
                }
                var f = updateFunc(line);
                f(line)
                    .then(function() {
                        $rootScope.$emit(thEvents.classificationVerified);
                    })
                    .catch(function(err) {
                        var msg = "Error saving classifications:\n ";
                        if (err.stack) {
                            msg += err + err.stack;
                        } else {
                            msg += err.statusText + " - " + err.data.detail;
                        }
                        thNotify.send(msg, "danger");
                    });
            },

            saveAll: function(lines) {
                console.log("ThStructuredLinePersist.saveAll");
                var byType = _.partition(
                    lines,
                    function(line) {
                        return (line.updateType === "Select" ||
                                line.updateType === "Update");
                    });

                var autoclassified = byType[0];
                var nonAutoclassified = byType[1];

                var byIgnoreOnce = _.partition(
                    nonAutoclassified,
                    function(line) {
                        return line.updateType === "Ignore";
                    });

                var ignoreOnce = byIgnoreOnce[0];
                // This includes ignore-always with bug number 0 and anything with an
                // unstructured classification
                var createFromBug = byIgnoreOnce[1];

                var byHasBug = _.partition(
                    autoclassified,
                    function(line) {return line.updateType === "Select";});

                var autoclassifiedHasBug = byHasBug[0];
                var autoclassifiedCreateBug = byHasBug[1];

                var updateClassifications = _.map(
                    autoclassifiedCreateBug,
                    function(line) {
                        return {id: line.classifiedFailureId,
                                bug_number: line.selectedOption.bugNumber};
                    }
                );

                var newClassifications = _.map(
                    createFromBug,
                    function(line) {
                        return {bug_number: line.selectedOption.bugNumber};
                    }
                );

                // Map of failure line id to best classified failure id
                var bestClassifications = _.map(
                    autoclassifiedHasBug,
                    function (line) {
                        return {
                            id: line.id,
                            best_classification: line.classifiedFailureId
                        };
                    });

                bestClassifications = bestClassifications.concat(
                    _.map(ignoreOnce,
                          function(line) {
                              return {id: line.id,
                                      best_classification: null};
                          }));

                function updateBestClassifications(lines, classifiedFailures) {
                    bestClassifications = bestClassifications.concat(
                        _.map(_.zip(lines, classifiedFailures),
                              function(item) {
                                  return {id: item[0].id,
                                          best_classification: item[1].id};
                              }));
                }

                var setupClassifiedFailures =
                        ThClassifiedFailuresModel.createMany(newClassifications)
                        .then(function(resp) {
                            console.log("after createMany");
                            if (resp) {
                                updateBestClassifications(createFromBug, resp.data);
                            }
                            return $q.defer();
                        })
                        .then(function () {
                            console.log("before updateMany");
                            return ThClassifiedFailuresModel.updateMany(updateClassifications);
                        })
                        .then(function(resp) {
                            console.log("after updateMany");
                            if (resp) {
                                updateBestClassifications(autoclassifiedCreateBug, resp.data);
                            }
                            return $q.defer();
                        });

                return setupClassifiedFailures
                    .then(function() {
                        console.log("before verifyMany");
                        return ThFailureLinesModel.verifyMany(bestClassifications);
                    })
                    .then(function() {
                        console.log("emit classificationVerified");
                        $rootScope.$emit(thEvents.classificationVerified, "structured");
                    })
                    .catch(function(err) {
                        $rootScope.$emit(thEvents.classificationError, "structured", err);
                    });
            }
        };

        thExtendProperties(ThStructuredLinePersist, persistInterface);

        return ThStructuredLinePersist;
    }]
);

treeherder.factory('ThUnstructuredLinePersist', [
    '$rootScope', 'thExtendProperties', 'thNotify', 'ThTextLogSummaryLineModel', 'thEvents',
    function($rootScope, thExtendProperties, thNotify, ThTextLogSummaryLineModel, thEvents) {
        var ThUnstructuredLinePersist = function() {};

        var persistInterface = {
            save: function(line) {
                return ThTextLogSummaryLineModel
                    .update(line.selectedOption.bugNumber)
                    .then(function() {
                        $rootScope.$emit(thEvents.classificationVerified);
                    });
            },

            saveAll: function(lines) {
                console.log("ThUnstructuredLinePersist.saveAll");
                var updateData = _.map(
                    lines,
                    function(line) {
                        return {id: line.id,
                                bug_number: line.selectedOption.bugNumber,
                                verified: true};
                    });
                ThTextLogSummaryLineModel.updateMany(updateData)
                    .then(function() {
                        $rootScope.$emit(thEvents.classificationVerified, "unstructured");
                    })
                    .catch(function(err) {
                        $rootScope.$emit(thEvents.classificationError, "unstructured", err);
                    });
            }
        };

        thExtendProperties(ThUnstructuredLinePersist, persistInterface);

        return ThUnstructuredLinePersist;
    }
]);
treeherder.factory('ThStructuredLine', ['thExtendProperties',
                                        'thValidBugNumber',
                                        'ThClassificationOption',
                                        'ThStructuredLinePersist',
                                        'thStringOverlap',
    function (thExtendProperties, thValidBugNumber, ThClassificationOption,
              ThStructuredLinePersist, thStringOverlap) {

        // this returns a function that builds a set of metadata for each
        // structured line with failure matches, describing what was matched
        function getClassifiedFailureMatcher(matchers, matches) {
            var matchesByClassifiedFailure = {};

            _.forEach(matches, function(match) {
                if (!matchesByClassifiedFailure[match.classified_failure]) {
                    matchesByClassifiedFailure[match.classified_failure] = [];
                }
                matchesByClassifiedFailure[match.classified_failure].push(match);
            });

            return function(cf_id) {
                return _.map(matchesByClassifiedFailure[cf_id],
                             function(match) {
                                 return {
                                     matcher: matchers[match.matcher],
                                     score: match.score
                                 };
                             });
            };
        }

        function autoclassifierOptions(classifiedFailures, getClassificationMatches) {
            // collect all the classified_failures.  But skip
            // ones with a null bug (classified_failures with
            // null bugs have no distinguishing features to make
            // them relevant).
            // If the "best" one has a null bug we will add
            // that in later.

            return classifiedFailures.filter(function(cf) {
                return (cf.bug_number !== null && cf.bug_number !== 0);
            }).map(function(cf) {
                return new ThClassificationOption("classified_failure",
                                                  cf.id,
                                                  cf.bug_number,
                                                  cf.bug ? cf.bug.summary : "",
                                                  cf.bug ? cf.bug.resolution : "",
                                                  getClassificationMatches(cf.id));
            });
        }

        function bugSuggestionOptions(data, autoOptions) {
            // Add bugs matched by orangefactor but not autoclassifier
            var autoBugs = autoOptions.reduce(function(classifiedBugs, x) {
                classifiedBugs.add(x.bugNumber);
                return classifiedBugs;
            }, new Set());

            var bugSuggestions = data.unstructured_bugs
                    .filter(function(bug) {
                        return !autoBugs.has(bug.id);
                    });

            var message = [data.test, data.subtest, data.message]
                    .filter(function(x) {return x !== null;})
                    .join(" ");

            var scores = bugSuggestions
                .reduce(function(scores, bug) {
                    var score = thStringOverlap(message, bug.summary);
                    // Artificially reduce the score of resolved bugs
                    score *= bug.resolution ? 0.8 : 1;
                    scores.set(bug.id, score);
                    return scores;
                }, new Map());

            return bugSuggestions
                .sort(function(a,b) {
                    return scores.get(b.id) - scores.get(a.id);
                })
                .map(function(bugSuggestion) {
                // adding a prefix to the bug id because,
                // theoretically, however unlikely, it could
                // conflict with a classified_failure id.
                    return new ThClassificationOption("unstructured_bug",
                                                      "ub-" + bugSuggestion.id,
                                                      bugSuggestion.id,
                                                      bugSuggestion.summary,
                                                      bugSuggestion.resolution);
                });
        }

        function bestAutoclassifiedOption(bestClassification, ui, getClassificationMatches) {
            var best = null;

            if (bestClassification) {
                best = _.find(ui.options,
                              {id: bestClassification});

                if (best && best.bug_number !== 0) {
                    // Remove the best match so we can add it at the start of the
                    // list later
                    ui.options = _.filter(ui.options,
                                          function(item) {
                                              return item.id !== best.id;
                                          });
                } else if (best && best.bugNumber === 0) {
                    return "ignore"; // This is a sentinel value we use when constructing the
                                     // ignore options later so that we can replace the best
                } else {
                    // The best classification didn't have a bug number so it needs a
                    // new entry (which we'll put in front)
                    best = new ThClassificationOption("classified_failure",
                                                      bestClassification,
                                                      null,
                                                      "",
                                                      "",
                                                      getClassificationMatches(bestClassification));
                }
                ui.options = [best].concat(ui.options);
            }
            return best;
        }

        function buildUIData(data, matchers) {
            var ui = {
                options: [],
                best: null
            };

            var getClassificationMatches = getClassifiedFailureMatcher(matchers,
                                                                       data.matches);

            var autoOptions = autoclassifierOptions(data.classified_failures,
                                                    getClassificationMatches);
            var otherOptions = bugSuggestionOptions(data, autoOptions);

            ui.options = ui.options.concat(autoOptions, otherOptions);
            ui.best = bestAutoclassifiedOption(data.best_classification, ui,
                                               getClassificationMatches);

            // add a manual option (for manually inputting a bug associated
            // with the failure line)
            ui.options.push(new ThClassificationOption("manual", "manual"));

            // add an ignore option (for automatically ignoring the failure
            // line in the future)
            var ignoreOption = new ThClassificationOption("ignore", "ignore", 0);
            ui.options.push(ignoreOption);

            if (ui.best === "ignore") {
                ui.best = ignoreOption;
                ignoreOption.always = true;
            } else if(ui.best && !ui.best.hasBug) {
                // If we have a best option with no bug, the UI won't display a
                // radio option for that case, set the default to the following option
                ui.selectedOptionIndex = 1;
            }
            if (ui.best) {
                ui.best.isBest = true;
            }

            return ui;
        }

        var ThStructuredLine = function(data, matchers) {
            var lineInterface = {
                type: "structured",
                data: data, // This rather breaks the interface but it makes things a bit easier for now
                options: null,
                best: null,
                selectedOptionIndex: 0,
                dirty: false, // Has line changed from its default value
                updateSelectOption: "Update",

                get id() {
                    return this.data.id;
                },

                get status() {
                    var rv;
                    if (data.best_is_verified) {
                        if (data.best_classification === null ||
                            data.best_classification.bug_number === 0) {
                            rv = 'ignored';
                        } else {
                            rv = 'verified';
                        }
                    }
                    else {
                        rv = 'pending';
                    }
                    return rv;
                },

                get canSave() {
                    return (this.selectedOption.type === "ignore" ||
                            thValidBugNumber(this.selectedOption.bugNumber));
                },

                get bugNumber() {
                    if (this.selectedOption.type === "ignore") {
                        return null;
                    }
                    return this.selectedOption.bugNumber;
                },

                get verifiedBugNumber() {
                    return this.status === 'verified' ? this.best.bugNumber : null;
                },

                get verifiedBugSummary() {
                    return this.status === 'verified' ? this.best.bugSummary : null;
                },

                get selectedOption() {
                    return this.options[this.selectedOptionIndex];
                },

                get updateText() {
                    var selected = this.selectedOption;

                    if (selected.type === "ignore") {
                        return ["Ignore"];
                    } else if(this.best && !this.best.hasBug) {
                        return ["Update", "Create"];
                    } else if (selected === this.best) {
                        return ["Verify"];
                    } else if (selected.type === "classified_failure") {
                        return ["Reclassify"];
                    } else if (selected.type === "unstructured_bug" ||
                               selected.type === "manual") {
                        // This is strictly untrue; we might reclassify if there's a
                        // classified failure with the same bug number that the autoclassifier
                        // didn't pick up at all.
                        return ["Create"];
                    }
                    return "";
                },

                get updateType() {
                    var selected = this.selectedOption;

                    if (selected.type === "ignore" && !selected.always) {
                        return "Ignore";
                    } else if (this.best && !this.best.hasBug) {
                        return this.updateSelectOption;
                    } else if (selected.type === "unstructured_bug" ||
                               selected.type === "manual" ||
                               (selected.type === "ignore" && selected.always)) {
                        return "Create";
                    }

                    return "Select";
                },

                get classifiedFailureId() {
                    if (this.status === 'verified') {
                        return this.data.best_classification;
                    } else if (this.best && !this.best.hasBug &&
                               this.updateSelectOption === "Update") {
                        return this.best.id;
                    } else if (this.selectedOption.type === "classified_failure") {
                        return this.selectedOption.id;
                    }
                    return null;
                },

                save: function() {
                    return ThStructuredLinePersist.save(this);
                }
            };

            // Set options and best
            thExtendProperties(lineInterface, buildUIData(data, matchers));

            thExtendProperties(this, lineInterface);
        };

        ThStructuredLine.saveAll = function(lines) {
            ThStructuredLinePersist.saveAll(lines);
        };

        return ThStructuredLine;
    }

]);

treeherder.factory('ThUnstructuredLine', ['thExtendProperties',
                                          'thValidBugNumber',
                                          'ThClassificationOption',
                                          'ThUnstructuredLinePersist',
                                          'thStringOverlap',
    function (thExtendProperties, thValidBugNumber, ThClassificationOption,
              ThUnstructuredLinePersist, thStringOverlap) {

        function bugSuggestionOptions(data) {
            var bugSuggestions = data.bugs.open_recent.concat(data.bugs.all_others);

            var scores = bugSuggestions
                    .reduce(function(scores, bug) {
                        var score = thStringOverlap(data.search, bug.summary);
                        // Artificially reduce the score of resolved bugs
                        score *= bug.resolution ? 0.8 : 1;
                        scores.set(bug.id, score);
                        return scores;
                    }, new Map());

            return bugSuggestions
                .sort(function(a,b) {
                    return scores.get(b.id) - scores.get(a.id);
                })
                .map(function(bugSuggestion) {
                    return new ThClassificationOption("unstructured_bug",
                                                      "ub-" + bugSuggestion.id,
                                                      bugSuggestion.id,
                                                      bugSuggestion.summary,
                                                      bugSuggestion.resolution);
                });
        }

        function buildUIData(data) {
            var ui = {
                options: [],
                best: null
            };

            if (data.verified) {
                return ui;
            }

            ui.options = bugSuggestionOptions(data);

            // add a manual option (for manually inputting a bug associated
            // with the failure line)
            ui.options.push(new ThClassificationOption("manual", "manual"));

            // add an ignore option (for automatically ignoring the failure
            // line in the future)
            ui.options.push(new ThClassificationOption("ignore", "ignore", 0));

            if (!isHelpfulLine(data.search)) {
                ui.selectedOptionIndex = ui.options.length - 1;
            }
            return ui;
        }

        var ThUnstructuredLine = function(data) {
            var lineInterface = {
                type: "unstructured",
                data: data,
                options: null,
                best: null,
                selectedOptionIndex: 0,
                dirty: false, // Has line changed from its default value

                get id() {
                    return data.id;
                },

                get status() {
                    if (data.verified) {
                        if (data.bug_number === 0 || data.bug_number === null) {
                            return 'ignored';
                        }

                        return 'verified';
                    }
                    return 'pending';
                },

                get canSave() {
                    return this.id && this.selectedOption &&
                        (this.selectedOption.type === "ignore" ||
                         thValidBugNumber(this.selectedOption.bugNumber));
                },

                get bugNumber() {
                    if(this.selectedOption.type === "manual") {
                        return this.selectedOption.bugNumber;
                    } else if (this.selectedOption.type === "ignore") {
                        if (this.selected.always) {
                            return 0;
                        }
                        return null;
                    }
                    return this.selectedOption.bugNumber;
                },

                get verifiedBugNumber() {
                    return this.status === 'verified' ? data.bug_number : null;
                },

                get verifiedBugSummary() {
                    return this.status === 'verified' ? data.bug.summary : null;
                },

                get selectedOption() {
                    return this.options[this.selectedOptionIndex];
                },

                get updateText() {
                    // This should never be called
                    return [""];
                },

                get updateType() {
                    return "Update";
                },

                get classifiedFailureId() {
                    return null;
                },

                save: function() {
                    ThUnstructuredLinePersist.save(this);
                }
            };

            // Set options and best
            thExtendProperties(lineInterface, buildUIData(data));

            thExtendProperties(this, lineInterface);
        };

        ThUnstructuredLine.saveAll = function(lines) {
            return ThUnstructuredLinePersist.saveAll(lines);
        };

        return ThUnstructuredLine;
    }
]);


treeherder.controller('ClassificationPluginCtrl', [
    '$q', '$scope', '$rootScope', 'ThLog', 'thEvents', 'thTabs',
    '$timeout', 'thNotify', 'ThFailureLinesModel', 'ThClassifiedFailuresModel',
    'ThMatcherModel', 'ThJobArtifactModel', 'ThTextLogSummaryModel', 'ThStructuredLine',
    'ThUnstructuredLine',
    function ClassificationPluginCtrl(
        $q, $scope, $rootScope, ThLog, thEvents, thTabs,
        $timeout, thNotify, ThFailureLinesModel, ThClassifiedFailuresModel,
        ThMatcherModel, ThJobArtifactModel, ThTextLogSummaryModel, ThStructuredLine,
        ThUnstructuredLine) {
        var $log = new ThLog(this.constructor.name);

        $log.debug("error classification plugin initialized");

        var reloadPromise = null;
        var requestPromise = null;
        var matchers = null;

        var getMatchers = function() {
            var p;
            if (matchers) {
                p = $q(function(resolve) {resolve(matchers);});
            } else {
                p = ThMatcherModel
                    .get_list()
                    .then(function(data) {
                        var matchersById = {};
                        _.forEach(data,
                                  function(matcher) {
                                      matchersById[matcher.id] = matcher;
                                  });
                        return matchersById;
                    });
            }
            return p;
        };

        var getFailureLines = function(timeoutPromise) {
            return ThFailureLinesModel.get_list($scope.jobId,
                                                {timeout: timeoutPromise,
                                                 cache: false});
        };

        var getSummaryLines = function(timeoutPromise) {
            return ThTextLogSummaryModel.get($scope.jobId,
                                             {timeout: timeoutPromise,
                                              cache: false});
        };

        thTabs.tabs.autoClassification.update = function() {
            console.log("thTabs.tabs.autoClassification.update");
            if (reloadPromise !== null) {
                reloadPromise.cancel();
            }
            $scope.jobId = thTabs.tabs.autoClassification.contentId;

            // if there's a ongoing request, abort it
            if (requestPromise !== null) {
                requestPromise.resolve();
            }

            requestPromise = $q.defer();

            thTabs.tabs.autoClassification.is_loading = true;
            if (!$scope.hasOwnProperty("triedLoad")) {
                $scope.triedLoad = false;
            }

            // If we have a TextLogSummaryModel then we should have enough data to
            // load this panel
            var checkLoaded = ThTextLogSummaryModel.get($scope.jobId,
                                                        {timeout: requestPromise,
                                                         cache: true});
            checkLoaded
                .then(function(loaded) {
                    if (!loaded) {
                        reloadPromise = $timeout(thTabs.tabs.autoClassification.update, 5000);
                    } else {
                        var resources = {
                            "matchers": getMatchers(requestPromise),
                            "failure_lines": getFailureLines(requestPromise),
                            "text_log_summary": getSummaryLines(requestPromise)
                        };
                        $q.all(resources)
                            .then(function(data) {
                                $scope.failureLines = buildFailureLineOptions(data);
                            })
                            .finally(function() {
                                thTabs.tabs.autoClassification.is_loading = false;
                                $scope.triedLoad = true;
                            });
                    }
                });
        };

        var mergeLines = function(matchers, failureLines, textLogSummary) {
            var structured = {};
            var structuredSeen = {};

            _.forEach(failureLines, function(line) {
                structured[line.id] = line;
            });

            var lastStructuredIndex = 0;
            var lines = _.map(textLogSummary.lines, function(line, i) {
                if (line.failure_line) {
                    lastStructuredIndex = i;
                    structuredSeen[line.failure_line] = true;
                    var failureLine = structured[line.failure_line];
                    return new ThStructuredLine(failureLine, matchers);
                }

                var unstructuredData = line;
                // XXX - this probably doesn't work when the
                // line is excluded from the bug suggestions
                _.extend(unstructuredData,
                         textLogSummary.bug_suggestions[i]);
                return new ThUnstructuredLine(unstructuredData);
            });

            _.forEach(failureLines, function(line) {
                if (!structuredSeen.hasOwnProperty(line.id)) {
                    lines.splice(lastStructuredIndex, 0,
                                 new ThStructuredLine(structured[line.id],
                                                      matchers));
                    lastStructuredIndex += 1;
                }
            });

            return lines;
        };

        var buildFailureLineOptions = function(data) {
            return mergeLines(data.matchers, data.failure_lines, data.text_log_summary);
        };

        function partitionByType(failureLines) {
            var rv = {};
            _.forEach(failureLines, function(line) {
                if (!rv.hasOwnProperty(line.type)) {
                    rv[line.type] = [];
                }
                rv[line.type].push(line);
            });
            return rv;
        }

        $scope.pendingLines = function() {
            return _.filter($scope.failureLines,
                            function(line) {
                                return line.status === 'pending';
                            });
        };

        $scope.loggedIn = function() {
            return $rootScope.user && $rootScope.user.loggedin;
        };

        $scope.canSaveAll = function() {
            if (!$scope.loggedIn()) {
                return false;
            }
            if (!$scope.pendingLines().length) {
                return false;
            }
            return (
                _.all($scope.pendingLines(),
                      function(line) {
                          return line.canSave;
                      }));
        };

        $scope.saveAll = function() {
            console.log("$scope.saveAll");
            var pending = $scope.pendingLines();
            var byType = partitionByType(pending);
            var types = {"unstructured": ThUnstructuredLine,
                         "structured": ThStructuredLine};
            var saveTypes = ["unstructured", "structured"]
                    .filter(function(x) {return byType.hasOwnProperty(x);});
            var savePromises = saveTypes
                    .map(function(x) {return types[x].saveAll(byType[x]);});

            /*
             Use a system of events to handle waiting for the
             classifications to be saved before trying to update the
             UI. A more obvious solution would seem to be something
             like

               $q.all(savePromises)
                 .then(() => thNotify.send("Classification saved", "sucess"))
                 .then(() => thTabs.tabs.autoClassification.update)

             However it turns out that this doesn't work with angular
             promises.  In particular it appears that promises which
             do something actually asynchronous can't be chained
             across scopes, so the above code will not wait for the
             HTTP calls in savePromises to complete before running the
             .then(() => thNotify.send(...)) call. Instead we hack a
             one-off deferal mechanism using events.

             When this code is rewritten, the design should be changed
             to allow for this limitation without the hack.
             */
            var pendingTypes = new Set(saveTypes);

            var errors = [];

            function afterVerification() {
                if (pendingTypes.size > 0) {
                    return;
                }
                deregisterSuccess();
                deregisterError();
                if (!errors.length) {
                    thNotify.send("Classification saved", "success");
                } else {
                    errors.map(function() {
                        var msg = "Error saving classifications:\n ";
                        if (err.stack) {
                            msg += err + err.stack;
                        } else {
                            msg += err.statusText + " - " + err.data.detail;
                        }
                        thNotify.send(msg, "danger");
                    });
                }
                thTabs.tabs.autoClassification.update();
            };

            var deregisterSuccess = $rootScope.$on(
                thEvents.classificationVerified, function(evt, type) {
                    pendingTypes.delete(type);
                    afterVerification();
                });

            var deregisterError = $rootScope.$on(
                thEvents.classificationError, function(evt, type, err) {
                    pendingTypes.delete(type);
                    errors.push(err);
                    afterVerification();
                });
        };

        $scope.canIgnore = function() {
            return $scope.pendingLines().length > 0;
        };

        $scope.status = function() {
            if (thTabs.tabs.autoClassification.is_loading ||
                !$scope.hasOwnProperty('failureLines')) {
                if (!$scope.triedLoad) {
                    return 'waiting';
                }
                return 'loading';
            } else if ($scope.failureLines.length === 0) {
                return 'empty';
            } else if ($scope.pendingLines().length === 0) {
                return 'verified';
            }
            return 'pending';
        };

        $scope.ignoreClean = function() {
            /*
             * Mark all lines that have not got a best classification and
             * have not been manually altered by a human as "ignore"
             */
            _.forEach($scope.pendingLines(),
                      function(line) {
                          if (!line.dirty && !line.best) {
                              // Set the selected option to the ignore option
                              line.selectedOptionIndex =
                                  _.findLastIndex(line.options,
                                                  function(x) {
                                                      return x.type === "ignore";
                                                  });
                              line.selectedOption.always = false;
                          }
                      });
        };

        $rootScope.$on(thEvents.saveAllAutoclassifications, function() {
            if ($scope.canSaveAll()) {
                $scope.saveAll();
            }
        });
        $rootScope.$on(thEvents.ignoreOthersAutoclassifications, function() {
            $scope.ignoreClean();
        });
    }
]);
