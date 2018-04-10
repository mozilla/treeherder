/* eslint-disable no-use-before-define, no-var, vars-on-top */
// TODO: Vet/fix the use-before-defines to ensure switching var
// to let/const won't break anything.

import treeherder from '../../js/treeherder';
import staticOptionTemplate from '../../plugins/auto_classification/staticOption.html';
import intermittentTemplate from '../../partials/main/intermittent.html';
import optionTemplate from '../../plugins/auto_classification/option.html';
import errorLineTemplate from '../../plugins/auto_classification/errorLine.html';
import errorsTemplate from '../../plugins/auto_classification/errors.html';
import toolbarTemplate from '../../plugins/auto_classification/toolbar.html';
import panelTemplate from '../../plugins/auto_classification/panel.html';
import { getBugUrl, getLogViewerUrl } from '../../helpers/urlHelper';
import { isReftest } from '../../helpers/jobHelper';
import { thJobNavSelectors, thEvents } from "../../js/constants";

treeherder.factory('thStringOverlap', function () {
    return function (str1, str2) {
        // Get a measure of the similarity of two strings by a simple process
        // of tokenizing and then computing the ratio of the tokens in common to
        // the total tokens

        var tokens = [str1, str2]
                .map(function (str) {
                    // Replace paths like /foo/bar/baz.html with just the filename baz.html
                    return str.replace(/[^\s]+\/([^\s]+)\s/,
                                       function (m, p1) {
                                           return " " + p1 + " ";
                                       });
                })
                .map(function (str) {
                    // Split into tokens on whitespace / ,  and |
                    return str.split(/[\s\/\,|]+/).filter(function (x) { return x !== ""; });
                });

        if (tokens[0].length === 0 || tokens[1].length === 0) {
            return 0;
        }

        var tokenCounts = tokens.map(function (tokens) {
            return _.countBy(tokens, function (x) { return x; });
        });

        var overlap = Object.keys(tokenCounts[0])
                .reduce(function (overlap, x) {
                    if (tokenCounts[1].hasOwnProperty(x)) {
                        overlap += 2 * Math.min(tokenCounts[0][x], tokenCounts[1][x]);
                    }
                    return overlap;
                }, 0);

        return overlap / (tokens[0].length + tokens[1].length);

    };
});

/**
 * Text Log Error model
 */
treeherder.factory('ThErrorLineData', [
    function () {
        function ThErrorLineData(line) {
            this.id = line.id;
            this.data = line;
            // If there was no metadata we get `undefined` here but we need
            // an actual boolean later
            this.verified = !!line.metadata.best_is_verified;
            this.bestClassification = line.metadata.best_classification ?
                line.classified_failures
                .find(cf => cf.id === line.metadata.best_classification) : null;
            this.bugNumber = this.bestClassification ?
                this.bestClassification.bug_number : null;
            this.verifiedIgnore = this.verified && (this.bugNumber === 0 ||
                                                    this.bestClassification === null);
            this.bugSummary = (this.bestClassification && this.bestClassification.bug) ?
                this.bestClassification.bug.summary : null;
        }
        return ThErrorLineData;
    }
]);

/**
 * Classification option model
 */
treeherder.factory('ThClassificationOption', ['thExtendProperties',
    function (thExtendProperties) {
        return function (type, id, classifiedFailureId, bugNumber,
                        bugSummary, bugResolution, matches) {
            thExtendProperties(this, {
                type: type,
                id: id,
                classifiedFailureId: classifiedFailureId || null,
                bugNumber: bugNumber || null,
                bugSummary: bugSummary || null,
                bugResolution: bugResolution || null,
                matches: matches || null,
                isBest: false,
                hidden: false,
                score: null,
                selectable: !(type === "classifiedFailure" && !bugNumber)
            });
        };
    }
]);

/**
 * Non-editable best option controller
 */
treeherder.controller('ThStaticClassificationOptionController', [
    '$scope', 'thPinboard',
    function ($scope, thPinboard) {
        var ctrl = this;

        $scope.getBugUrl = getBugUrl;
        $scope.thPinboard = thPinboard;

        ctrl.$onChanges = () => {
            $scope.line = ctrl.errorLine;
            $scope.option = ctrl.optionData;
        };
    }
]);

treeherder.component('thStaticClassificationOption', {
    template: staticOptionTemplate,
    controller: 'ThStaticClassificationOptionController',
    bindings: {
        thJob: '<',
        errorLine: '<',
        optionData: '<',
        selectedOption: '<',
        numOptions: '<',
        canClassify: '<',
        onExpandOptions: '&'
    }
});

/**
 * Editable option component controller
 */
treeherder.controller('ThClassificationOptionController', [
    '$scope', '$uibModal', 'thPinboard',
    '$rootScope',
    function ($scope, $uibModal, thPinboard, $rootScope) {
        var ctrl = this;

        $scope.getBugUrl = getBugUrl;
        $scope.thPinboard = thPinboard;

        ctrl.$onChanges = () => {
            $scope.line = ctrl.errorLine;
            $scope.option = ctrl.optionData;
        };

        $scope.onChange = () => {
            ctrl.onChange();
        };

        $scope.fileBug = function () {
            var reftestUrlRoot = "https://hg.mozilla.org/mozilla-central/raw-file/tip/layout/tools/reftest/reftest-analyzer.xhtml#logurl=";

            var logUrl = ctrl.thJob.logs.filter(x => x.name.endsWith("_json"));
            logUrl = logUrl[0] ? logUrl[0].url : ctrl.thJob.logs[0];

            var crashSignatures = [];
            var crashRegex = /application crashed \[@ (.+)\]$/g;

            var crash = ctrl.errorLine.data.bug_suggestions.search.match(crashRegex);
            if (crash) {
                var signature = crash[0].split("application crashed ")[1];
                if (!crashSignatures.includes(signature)) {
                    crashSignatures.push(signature);
                }
            }

            var modalInstance = $uibModal.open({
                template: intermittentTemplate,
                controller: 'BugFilerCtrl',
                size: 'lg',
                openedClass: "filer-open",
                resolve: {
                    summary: () => ctrl.errorLine.data.bug_suggestions.search,
                    search_terms: () => ctrl.errorLine.data.bug_suggestions.search_terms,
                    fullLog: () => logUrl,
                    parsedLog: () => location.origin + "/" + getLogViewerUrl(ctrl.thJob.id, $rootScope.repoName),
                    reftest: () => (isReftest(ctrl.thJob) ? reftestUrlRoot + logUrl + "&only_show_unexpected=1" : ""),
                    selectedJob: () => ctrl.thJob,
                    allFailures: () => [ctrl.errorLine.data.bug_suggestions.search.split(" | ")],
                    crashSignatures: () => crashSignatures,
                    successCallback: () => (data) => {
                        var bugId = data.success;
                        ctrl.selectedOption.manualBugNumber = bugId;
                        window.open("https://bugzilla.mozilla.org/show_bug.cgi?id=" + bugId);
                        ctrl.onChange();
                    }
                }
            });
            ctrl.selectedOption.id = ctrl.optionData.id;
            modalInstance.opened.then(() => modalInstance.initiate());
        };
    }
]);

treeherder.component('thClassificationOption', {
    template: optionTemplate,
    controller: 'ThClassificationOptionController',
    bindings: {
        thJob: '<',
        errorLine: '<',
        optionData: '<',
        canClassify: '<',
        selectedOption: '=',
        onChange: '&'
    }
});

/**
 * Error line component controller
 */
treeherder.controller('ThErrorLineController', [
    '$scope', '$rootScope',
    'ThClassificationOption', 'thStringOverlap',
    function ($scope, $rootScope,
              ThClassificationOption, thStringOverlap) {
        var ctrl = this;
        var line;
        // Map between option id and option data
        var optionsById = null;
        // initial best option
        var bestOption;

        var goodMatchScore = 0.75;
        var badMatchScore = 0.25;

        $scope.getBugUrl = getBugUrl;

        // Show options that are marked as hidden
        $scope.showHidden = false;

        ctrl.$onChanges = (changes) => {
            var changed = x => changes.hasOwnProperty(x);
            if (changed("errorMatchers") || changed("errorLine")) {
                build();
            }
            $scope.verified = line.data.metadata.best_is_verified;
            $scope.failureLine = line.data.metadata.failure_line;
            $scope.searchLine = line.data.bug_suggestions.search;
        };

        /**
         * (Re)build the error line display
         */
        function build() {
            line = ctrl.errorLine;
            $scope.line = line;
            $scope.logUrl = getLogViewerUrl(ctrl.thJob.id, $rootScope.repoName, line.data.line_number + 1);
            if (!line.verified) {
                $scope.options = getOptions();
                $scope.extraOptions = getExtraOptions($scope.options);

                var allOptions = $scope.options.concat($scope.extraOptions);

                optionsById = allOptions.reduce((byId, option) => {
                    byId.set(option.id, option);
                    return byId;
                }, new Map());

                var defaultOption = getDefaultOption($scope.options,
                                                     $scope.extraOptions,
                                                     ctrl.prevErrorLine);
                $scope.selectedOption = {
                    id: defaultOption.id,
                    manualBugNumber: "",
                    ignoreAlways: false
                };
                $scope.editableChanged(defaultEditable());
                $scope.optionChanged();
            } else {
                $scope.options = [];
                $scope.extraOptions = [];
                $scope.selectedOption = {
                    id: null,
                    manualBugNumber: "",
                    ignoreAlways: false
                };
            }
        }

        /**
         * Currently selected option data
         */
        function currentOption() {
            if (!optionsById) {
                return null;
            }
            return optionsById.get($scope.selectedOption.id);
        }

        /**
         * Test if any options in a list are hidden
         * @param {Object[]} options - List of options
         */
        $scope.hasHidden = function (options) {
            return options.some(option => option.hidden);
        };

        /**
         * Update data about the currently selected option in response to
         * a selection in the UI
         */
        $scope.optionChanged = function () {
            const option = currentOption();
            $scope.currentOption = option;
            // If the best option is a classified failure with no associated bug number
            // then default to updating that option with a new bug number
            // TODO: consider adding the update/create options back here, although it's
            // not clear anyone ever understood how they were supposed to work
            var classifiedFailureId = ((bestOption &&
                                        bestOption.classifiedFailureId &&
                                        bestOption.bugNumber === null) ?
                                       bestOption.classifiedFailureId :
                                       option.classifiedFailureId);
            var bug = (option.type === "manual" ?
                       $scope.selectedOption.manualBugNumber :
                       (option.type === "ignore" ?
                        ($scope.selectedOption.ignoreAlways ? 0 : null) :
                        option.bugNumber));
            var data = {
                lineId: line.id,
                type: option.type,
                classifiedFailureId: classifiedFailureId,
                bugNumber: bug
            };
            ctrl.onChange(data);
        };

        $scope.editableChanged = function (editable) {
            ctrl.onEditableChange({
                lineId: line.id,
                editable: editable
            });
        };

        /**
         * Build a list of options applicable to the current line.
         */
        function getOptions() {
            var bugSuggestions = [].concat(
                line.data.bug_suggestions.bugs.open_recent,
                line.data.bug_suggestions.bugs.all_others);

            var classificationMatches = getClassifiedFailureMatcher();

            var autoclassifyOptions = line.data.classified_failures
                    .filter(cf => cf.bug_number !== 0)
                    .map(cf => new ThClassificationOption("classifiedFailure",
                                                            line.id + "-" + cf.id,
                                                            cf.id,
                                                            cf.bug_number,
                                                            cf.bug ? cf.bug.summary : "",
                                                            cf.bug ? cf.bug.resolution : "",
                                                            classificationMatches(cf.id)));
            var autoclassifiedBugs = autoclassifyOptions
                    .reduce((classifiedBugs, option) => classifiedBugs.add(option.bugNumber),
                            new Set());

            var bugSuggestionOptions = bugSuggestions
                    .filter(bug => !autoclassifiedBugs.has(bug.id))
                    .map(bugSuggestion => new ThClassificationOption("unstructuredBug",
                                                                       line.id + "-ub-" + bugSuggestion.id,
                                                                       null,
                                                                       bugSuggestion.id,
                                                                       bugSuggestion.summary,
                                                                       bugSuggestion.resolution));

            bestOption = null;

            // Look for an option that has been marked as the best classification.
            // This is always sorted first and never hidden, so we remove it and readd it.
            if (!bestIsIgnore()) {
                var bestIndex = line.bestClassification ?
                        autoclassifyOptions
                        .findIndex(option => option.classifiedFailureId === line.bestClassification.id) : -1;

                if (bestIndex > -1) {
                    bestOption = autoclassifyOptions[bestIndex];
                    bestOption.isBest = true;
                    autoclassifyOptions.splice(bestIndex, 1);
                    scoreOptions([bestOption]);
                }
            }

            var options = autoclassifyOptions.concat(bugSuggestionOptions);
            scoreOptions(options);
            sortOptions(options);

            if (bestOption) {
                options.unshift(bestOption);
            }

            markHidden(options);

            return options;
        }

        /**
         * Build a list of the default options that apply to all lines.
         */
        function getExtraOptions() {
            var extraOptions = [new ThClassificationOption("manual", line.id + "-manual")];
            var ignoreOption = new ThClassificationOption("ignore", line.id + "-ignore", 0);
            extraOptions.push(ignoreOption);
            if (bestIsIgnore()) {
                ignoreOption.isBest = true;
            }
            return extraOptions;
        }

        /**
         * Test if the initial best option is to ignore the line
         */
        function bestIsIgnore() {
            return (line.data.metadata.best_classification &&
                    line.data.metadata.best_classification.bugNumber === 0);
        }

        /**
         * Give each option in a list a score based on either autoclassifier-provided score
         * or a textual overlap between a bug suggestion and the log data in the error line.
         * @param {Object[]} options - List of options to score
         */
        function scoreOptions(options) {
            options
                .forEach((option) => {
                    var score;
                    var data = line.data;
                    if (option.type === "classifiedFailure") {
                        score = parseFloat(
                            data.matches.find(
                                x => x.classified_failure === option.classifiedFailureId).score);
                    } else {
                        score = thStringOverlap(data.bug_suggestions.search,
                                                option.bugSummary.replace(/^\s*Intermittent\s+/, ""));
                        // Artificially reduce the score of resolved bugs
                        score *= option.bugResolution ? 0.8 : 1;
                    }
                    option.score = score;
                });
        }

        /**
         * Sort a list of options by score
         * @param {Object[]} options - List of options to sort
         */
        function sortOptions(options) {
            // Sort all the possible failure line options by their score
            options.sort((a, b) => b.score - a.score);
        }

        /**
         * Mark some options hidden based on a heuristic to ensure that we initially
         * show only the most likely bug suggestion options to sheriffs.
         * @param {Object[]} options - List of options to potentially hide
         */
        function markHidden(options) {
            // Mark some options as hidden by default
            // We do this if the score is too low compared to the best option
            // or if the score is below some threshold or if there are too many
            // options
            if (!options.length) {
                return;
            }

            var bestOption = options[0];

            var lowerCutoff = 0.1;
            var bestRatio = 0.5;
            var maxOptions = 10;
            var minOptions = 1;

            var bestScore = bestOption.score;

            options.forEach((option, idx) => {
                option.hidden = idx > (minOptions - 1) &&
                    (option.score < lowerCutoff ||
                     option.score < bestRatio * bestScore ||
                     idx > (maxOptions - 1));
            });
        }

        /**
         * Return a function that takes a classified failure id and returns the
         * matcher that provided the best match, and the score of that match.
         */
        function getClassifiedFailureMatcher() {
            var matchesByCF = line.data.matches.reduce(
                function (matchesByCF, match) {
                    if (!matchesByCF.has(match.classified_failure)) {
                        matchesByCF.set(match.classified_failure, []);
                    }
                    matchesByCF.get(match.classified_failure).push(match);
                    return matchesByCF;
                }, new Map());

            return function (cf_id) {
                return matchesByCF.get(cf_id).map(
                    function (match) {
                        return {
                            matcher: ctrl.errorMatchers.get(match.matcher),
                            score: match.score
                        };
                    });
            };
        }

        /**
         * Get the initial default option
         * @param {Object[]} options - List of line-specific options
         * @param {Object[]} extraOptions - List of line-independent options
         * @param {Object[]} prevLine - Line before the current one in the log
         */
        function getDefaultOption(options, extraOptions, prevLine) {
            // If we have a best option from the autoclassifier use that
            if (options.length && options[0].isBest && options[0].selectable) {
                return options[0];
            }

            // Otherwise we need to decide whether to use a bug suggestion
            // or to ignore the line
            var failureLine = line.data.failure_line;

            function parseTest(line) {
                var parts = line.split(" | ", 3);
                return parts.length === 3 ? parts[1] : null;
            }

            // Search for the best selectable bug suggestion, using the fact that
            // these are already sorted by string overlap
            var bestOption = options.find(option => option.selectable);

            // If that suggestion is good enough just use it
            if (bestOption && bestOption.score >= goodMatchScore) {
                return bestOption;
            }

            /* If there was no autoclassification and no good
             * suggestions, we need to guess whether this is an
             * ignorable line or one which must be classified. The
             * general approach is to assume a pure log line
             * without any keywords that indicate importance is
             * ignorable, as is a test line from the same test as
             * the previous line. Otherwise we assume that the
             * line pertains to a new bug
             */

            // Get the test id for this line and the last line, if any
            var thisTest = failureLine ? failureLine.test :
                    parseTest(line.data.bug_suggestions.search);
            var prevTest = prevLine ? (prevLine.data.failure_line ?
                                       prevLine.data.failure_line.test :
                                       parseTest(prevLine.data.bug_suggestions.search)) :
                null;

            var ignore;

            // Strings indicating lines that should not be ignored
            var importantLines = [
                /\d+ bytes leaked/,
                /application crashed/,
                /TEST-UNEXPECTED-/
            ];

            if (prevTest && thisTest && prevTest === thisTest) {
                // If the previous line was about the same test as
                // this one and this doesn't have any good bug
                // suggestions, we assume that is the signature line
                // and this is ignorable
                ignore = true;
            } else if (failureLine &&
                       (failureLine.action === "crash" ||
                        failureLine.action === "test_result")) {
                // Don't ignore crashes or test results
                ignore = false;
            } else {
                // Don't ignore lines containing a well-known string
                var message = failureLine ?
                        (failureLine.signature ? failureLine.signature :
                         failureLine.message) :
                    line.data.bug_suggestions.search;
                ignore = !importantLines.some(x => x.test(message));
            }
            // If we didn't choose to ignore the line and there is a bug suggestion
            // that isn't terrible, use that
            if (!ignore && bestOption && bestOption.score > badMatchScore) {
                return bestOption;
            }
            //Otherwise select either the ignore option or the manual bug option
            var offset = ignore ? -1 : -2;

            return extraOptions[extraOptions.length + offset];
        }

        /**
         * Determine whether the line should be open for editing by default
         */
        function defaultEditable() {
            var option = currentOption();
            return !(option.score >= goodMatchScore || option.type === "ignore");
        }

        /**
         * Select the ignore option, and toggle the ignoreAlways setting if it's
         * already selected
         */
        ctrl.onEventIgnore = function () {
            if (!ctrl.isSelected) {
                return;
            }
            var id = line.id + "-ignore";
            if (id !== $scope.selectedOption.id) {
                $scope.selectedOption.id = id;
            } else {
                $scope.selectedOption.ignoreAlways = !$scope.selectedOption.ignoreAlways;
            }
            $scope.optionChanged();
        };

        /**
         * Select a specified options
         * @param {string} option - numeric id of the option to select or '=' to select the
                                    manual option
         */
        ctrl.onEventSelectOption = function (option) {
            if (!ctrl.isSelected || !ctrl.isEditable) {
                return;
            }
            var id;
            if (option === "manual") {
                id = line.id + "-manual";
            } else {
                var idx = parseInt(option);
                var selectableOptions = $scope.options.filter(option => option.selectable);
                if (selectableOptions[idx]) {
                    id = selectableOptions[idx].id;
                }
            }
            if (!optionsById.has(id)) {
                return;
            }
            if (id !== $scope.selectedOption.id) {
                $scope.selectedOption.id = id;
                $scope.optionChanged();
            }
            if (option === "=") {
                $("#" + line.id + "-manual-bug").focus();
            }
        };

        /**
         * Expand or collapse hidden options
         */
        ctrl.onEventToggleExpandOptions = function () {
            if (!ctrl.isSelected || !ctrl.isEditable) {
                return;
            }
            $scope.showHidden = !$scope.showHidden;
        };

        $scope.$watch('selectedOption', () => {
            var option = currentOption();
            if (!currentOption) {
                return;
            }
            var oldStatus = $scope.status;

            if (!ctrl.canClassify) {
                $scope.status = 'classification-disabled';
            } else if (line.verified) {
                $scope.status = 'verified';
            } else if (option.type === 'ignore') {
                $scope.status = 'unverified-ignore';
            } else if (option.type === "manual" &&
                       !$scope.selectedOption.manualBugNumber) {
                $scope.status = 'unverified-no-bug';
            } else {
                $scope.status = 'unverified';
            }
            if (oldStatus !== $scope.status) {
                ctrl.onStatusChange({ status: $scope.status });
            }
        }, true);

        $rootScope.$on(thEvents.autoclassifySelectOption,
                       (ev, key) => ctrl.onEventSelectOption(key));

        $rootScope.$on(thEvents.autoclassifyIgnore,
                       () => ctrl.onEventIgnore());

        $rootScope.$on(thEvents.autoclassifyToggleExpandOptions,
                       () => ctrl.onEventToggleExpandOptions());
    }
]);

treeherder.component('thErrorLine', {
    template: errorLineTemplate,
    controller: 'ThErrorLineController',
    bindings: {
        thJob: '<',
        errorMatchers: '<',
        errorLine: '<',
        prevErrorLine: '<',
        isSelected: '<',
        isEditable: '<',
        canClassify: '<',
        onChange: '&',
        onEditableChange: '&',
        onStatusChange: '&'
    }
});

/**
 * Error lines component controller
 */
treeherder.controller('ThAutoclassifyErrorsController', ['$scope', '$element',
    function ($scope, $element) {
        var ctrl = this;
        $scope.lineStatuses = new Map();

        $scope.titles = {
            verified: "Verified Line",
            'unverified-ignore': "Unverified line, ignored",
            'unverified-no-bug': "Unverified line missing a bug number",
            unverified: "Unverified line",
            'classification-disabled': ""
        };

        /**
         * Toggle the selection of a th-error-line, if the click didn't happen on an interactive
         * element child of that line.
         */
        $scope.toggleSelect = function (event, id) {
            var target = $(event.target);
            var elem = target;
            var interactive = new Set(["INPUT", "BUTTON", "TEXTAREA", "A"]);
            while (elem.length && elem[0] !== $element[0]) {
                if (interactive.has(elem.prop("tagName"))) {
                    return;
                }
                elem = elem.parent();
            }
            // ctrl+click on mac is same as right-click, so use meta key instead
            ctrl.onToggleSelect({ lineIds: [id], clear: !(event.ctrlKey || event.metaKey) });
        };
    }
]);

treeherder.component('thAutoclassifyErrors', {
    template: errorsTemplate,
    controller: "ThAutoclassifyErrorsController",
    bindings: {
        thJob: '<',
        loadStatus: '<',
        errorMatchers: '<',
        errorLines: '<',
        selectedLineIds: '<',
        editableLineIds: '<',
        canClassify: '<',
        onUpdateLine: '&',
        onLineEditableChange: '&',
        onToggleSelect: '&'
    }
});

/**
 * Toolbar controller
 */
treeherder.controller('ThAutoclassifyToolbarController', [
    '$scope',
    function ($scope) {
        var ctrl = this;

        $scope.buttonTitle = function (condition, activeTitle, inactiveTitle) {
            if (!ctrl.thUser || !ctrl.thUser.loggedin) {
                return "Must be logged in";
            }
            if (!ctrl.thUser.is_staff) {
                return "Insufficeint permissions";
            }
            if (condition) {
                return activeTitle;
            }
            return inactiveTitle;
        };
    }
]);

treeherder.component('thAutoclassifyToolbar', {
    template: toolbarTemplate,
    controller: "ThAutoclassifyToolbarController",
    bindings: {
        loadStatus: '<',
        autoclassifyStatus: '<',
        thUser: '<',
        canSave: '<',
        canSaveAll: '<',
        canClassify: '<',
        hasSelection: '<',
        onIgnore: '&',
        onSave: '&',
        onSaveAll: '&',
        onEdit: '&',
        onPin: '&'
    }
});

/**
 * Main controller for the autoclassification panel.
 */
treeherder.controller('ThAutoclassifyPanelController', [
    '$scope', '$rootScope', '$q',
    'thNotify', 'thPinboard',
    'ThMatcherModel', 'ThTextLogErrorsModel', 'ThErrorLineData',
    function ($scope, $rootScope, $q,
             thNotify, thPinboard,
             ThMatcherModel, ThTextLogErrorsModel, ThErrorLineData) {

        var ctrl = this;

        var requestPromise = null;

        // Map between TextLogError id and data.
        var linesById = null;

        // Autoclassify status when the panel last loaded
        var autoclassifyStatusOnLoad = null;

        // Map between line id and state selected in the UI
        var stateByLine = null;

        ctrl.$onChanges = (changes) => {
            var changed = x => changes.hasOwnProperty(x);

            $scope.canClassify = (ctrl.thUser &&
                                  ctrl.thUser.loggedin &&
                                  ctrl.thUser.is_staff);
            if (changed("thJob")) {
                if (ctrl.thJob.id) {
                    jobChanged();
                }
            } else if (changed("hasLogs") || changed("logsParsed") ||
                       changed("logParseStatus") || changed("autoclassifyStatus")) {
                build();
            }
        };

        /**
         * Update the panel for a new job selection
         */
        function jobChanged() {
            ctrl.loadStatus = "loading";
            linesById = new Map();
            ctrl.selectedLineIds = new Set();
            ctrl.editableLineIds = new Set();
            stateByLine = new Map();
            autoclassifyStatusOnLoad = null;
            build();
        }

        /**
         * (Re)build all the panel contents with fresh data
         */
        function build() {
            if (ctrl.thJob.state === "pending" || ctrl.thJob.state === "running") {
                ctrl.loadStatus = "job_pending";
            } else if (!ctrl.logsParsed || ctrl.autoclassifyStatus === "pending") {
                ctrl.loadStatus = "pending";
            } else if (ctrl.logParsingFailed) {
                ctrl.loadStatus = "failed";
            } else if (!ctrl.hasLogs) {
                ctrl.loadStatus = "no_logs";
            } else if ((autoclassifyStatusOnLoad === null ||
                        autoclassifyStatusOnLoad === "cross_referenced")) {
                if (ctrl.loadStatus !== "ready") {
                    ctrl.loadStatus = "loading";
                }
                fetchErrorData()
                    .then(data => buildLines(data))
                    .catch(() => {
                        ctrl.loadStatus = "error";
                    });
            }
        }


        /**
         * Build panel contents with HTTP response data
         * @param {Object} data - HTTP response data
         */
        function buildLines(data) {
            $scope.errorMatchers = data.matchers;
            loadData(data.error_lines);
            $scope.errorLines
                .forEach(line => stateByLine.set(
                    line.id, {
                        classifiedFailureId: null,
                        bugNumber: null,
                        type: null
                    }));
            requestPromise = null;
            // Store the autoclassify status so that we only retry
            // the load when moving from 'cross_referenced' to 'autoclassified'
            autoclassifyStatusOnLoad = ctrl.autoclassifyStatus;
            // Preselect the first line
            var selectable = selectableLines();
            if (selectable.length) {
                ctrl.selectedLineIds.add(selectable[0].id);
                // Run this after the DOM has rendered
                $scope.$evalAsync(
                    () => {
                        var elem = $("th-autoclassify-errors th-error-line")[0];
                        if (elem) {
                            elem.scrollIntoView({
                                behavior: "smooth",
                                block: "start"
                            });
                        }
                    });
            }
            $scope.$evalAsync(() => { ctrl.loadStatus = "ready"; });
        }

        /**
         * Get TextLogerror data from the API
         */
        function fetchErrorData() {
            // if there's a ongoing request, abort it
            if (requestPromise !== null) {
                requestPromise.resolve();
            }

            requestPromise = $q.defer();

            return $q.all({
                matchers: ThMatcherModel.by_id(),
                error_lines: ThTextLogErrorsModel.getList(ctrl.thJob.id,
                                                            { timeout: requestPromise })
            });
        }

        /**
         * Convert the HTTP response data for TextLogErrors into the form
         * used internally, and set the initial control status
         * @param {Object[]} lines - Array of TextLogError objects representing log lines
         */
        function loadData(lines) {
            linesById = lines
                .reduce((byId, line) => {
                    byId.set(line.id, new ThErrorLineData(line));
                    return byId;
                }, linesById);
            $scope.errorLines = Array.from(linesById.values());
            // Resort the lines to allow for in-place updates
            $scope.errorLines.sort((a, b) => a.data.id - b.data.id);
        }

        /**
         * Save all pending lines
         */
        ctrl.onSaveAll = function () {
            save($scope.pendingLines())
                .then(() => {
                    signalFullyClassified();
                });
            ctrl.selectedLineIds.clear();
        };

        /**
         * Save all selected lines
         */
        ctrl.onSave = function () {
            save($scope.selectedLines())
            .then(() => {
                if ($scope.pendingLines().length === 0) {
                    signalFullyClassified();
                }
            });
        };

        /**
         * Emit an event indicating that the job has been fully classified
         */
        function signalFullyClassified() {
            var jobs = {};
            jobs[ctrl.thJob.id] = ctrl.thJob;
            // Emit this event to get the main UI to update
            $rootScope.$emit(thEvents.autoclassifyVerified, { jobs: jobs });
        }

        /**
         * Ignore selected lines
         */
        ctrl.onIgnore = function () {
            $rootScope.$emit(thEvents.autoclassifyIgnore);
        };

        /**
         * Pin selected job to the pinboard
         */

        ctrl.onPin = function () {
            //TODO: consider whether this should add bugs or mark all lines as ignored
            thPinboard.pinJob(ctrl.thJob);
        };

        /**
         * Update internal line state after it is changed in the UI
         * @param {number} lineId - id of the TextLogError
         * @param {string} type - Type of classification
         * @param {?number} classifiedFailureId - id of classified failure
         * @param {?bugNumber} bugNumber - id of bug
         */
        ctrl.onUpdateLine = function (lineId, type, classifiedFailureId, bugNumber) {
            var state = stateByLine.get(lineId);
            state.type = type;
            state.classifiedFailureId = classifiedFailureId;
            state.bugNumber = bugNumber;
        };

        /**
         * Toggle the selection of lines
         * @param {number[]} lineIds - ids of the lines to toggle
         * @param {boolean} clear - Clear the current selection before selecting new elements
         */
        ctrl.onToggleSelect = function (lineIds, clear) {
            var isSelected = lineIds
                    .reduce((map, lineId) => map.set(lineId, ctrl.selectedLineIds.has(lineId)),
                            new Map());
            if (clear) {
                ctrl.selectedLineIds.clear();
            }
            lineIds.forEach((lineId) => {
                var line = linesById.get(lineId);
                if (isSelected.get(lineId)) {
                    ctrl.selectedLineIds.delete(lineId);
                } else if (!line.verified) {
                    ctrl.selectedLineIds.add(lineId);
                }
            });
        };

        ctrl.onToggleEditable = function () {
            var selectedIds = Array.from(ctrl.selectedLineIds);
            var editable = selectedIds.some(id => !ctrl.editableLineIds.has(id));
            setEditable(selectedIds, editable);
        };

        ctrl.onEditableChange = function (lineId, editable) {
            setEditable([lineId], editable);
        };

        ctrl.onOpenLogViewer = function () {
            var selected = $scope.selectedLines();
            var lineNumber;
            if (selected.length) {
                lineNumber = selected[0].data.line_number + 1;
            }
            window.open(getLogViewerUrl(ctrl.thJob.id, $rootScope.repoName, lineNumber));
        };

        function setEditable(lineIds, editable) {
            var f = editable ? lineId => ctrl.editableLineIds.add(lineId):
                    lineId => ctrl.editableLineIds.delete(lineId);
            lineIds.forEach(f);
        }

        /**
         * Pre-determined selection changes, typically for use in response to
         * key events.
         * @param {string} direction - 'next': select the row after the last selected row or
         *                                     the next job if this is the last row (and clear
         *                                     is false)
         *                             'previous': select the row before the first selected row
         *                                         or move to the previous job if the first row
         *                                         is selected and clear is false.
         *                             'all_next': Select all rows in the current job after the
         *                                         current selected row.
         * @param {boolean} clear - Clear the current selection before selecting new elements
         */
        ctrl.onChangeSelection = function (direction, clear) {
            var selectable = selectableLines();

            var optionIndexes = selectable
                    .reduce((idxs, x, i) => idxs.set(x.id, i), new Map());
            var selectableIndexes = Array.from(optionIndexes.values());

            var minIndex = selectable.length ?
                    selectableIndexes
                    .reduce((min, idx) => (idx < min ? idx : min), $scope.errorLines.length) :
                null;

            var selected = $scope.selectedLines();
            var indexes = [];
            if (direction === "next") {
                if (selected.length) {
                    var next = selectableIndexes
                            .find(x => x > optionIndexes.get(selected[selected.length - 1].id));
                    indexes.push(next !== undefined ? next : "nextJob");
                } else {
                    indexes.push(minIndex !== null ? minIndex : "nextJob");
                }
            } else if (direction === "previous") {
                if (selected.length) {
                    var prev = [].concat(selectableIndexes).reverse()
                            .find(x => x < optionIndexes.get(selected[0].id));
                    indexes.push(prev !== undefined ? prev : "prevJob");
                } else {
                    indexes.push("prevJob");
                }
            } else if (direction === "all_next" && selected.length && selectable.length) {
                indexes = selectableIndexes
                    .filter(x => x > optionIndexes.get(selected[selected.length - 1].id));
            }

            if (clear) {
                // Move to the next or previous panels if we moved out of bounds
                if (indexes.some(x => x === "nextJob")) {
                    $rootScope.$emit(thEvents.changeSelection,
                                     'next',
                                     thJobNavSelectors.UNCLASSIFIED_FAILURES);
                    return;
                } else if (indexes.some(x => x === "prevJob")) {
                    $rootScope.$emit(thEvents.changeSelection,
                                     'previous',
                                     thJobNavSelectors.UNCLASSIFIED_FAILURES);
                    return;
                }
            } else if (indexes.some(x => x === "prevJob" || x === "nextJob")) {
                return;
            }
            var lineIds = indexes.map(idx => selectable[idx].id);
            ctrl.onToggleSelect(lineIds, clear);
            $scope.$evalAsync(
                () => $("th-autoclassify-errors th-error-line")[indexes[0]]
                    .scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    }));
        };

        /**
         * Test if it is possible to save a specific line.
         * @param {number} lineId - Line id to test.
         */
        function canSave(lineId) {
            if (!$scope.canClassify) {
                return false;
            }
            var state = stateByLine.get(lineId);
            if (!state) {
                //This can happen when we are switching jobs
                return false;
            }
            if (state.type === null) {
                return false;
            }
            if (state.type === "ignore") {
                return true;
            }
            return !!(state.classifiedFailureId || state.bugNumber);
        }

        /**
         * Test if it is possible to save all in a list of lines.
         * @param {number[]} lineIds - Line ids to test.
         */
        $scope.canSave = function (lines) {
            return ($scope.canClassify && lines.length &&
                    lines.every(line => canSave(line.id)));
        };

        /**
         * Update and mark verified the classification of a list of lines on
         * the server.
         * @param {number[]} lines - Lines to test.
         */
        function save(lines) {
            var data = lines.map((line) => {
                var state = stateByLine.get(line.id);
                var bestClassification = state.classifiedFailureId || null;
                var bugNumber = state.bugNumber;
                return {
                    id: line.id,
                    best_classification: bestClassification,
                    bug_number: bugNumber
                };
            });
            ctrl.loadStatus = "loading";
            return ThTextLogErrorsModel
                .verifyMany(data)
                .then((resp) => {
                    loadData(resp.data);
                    ctrl.loadStatus = "ready";
                })
                .catch((err) => {
                    var msg = "Error saving classifications:\n ";
                    if (err.stack) {
                        msg += err + err.stack;
                    } else {
                        msg += err.statusText + " - " + err.data.detail;
                    }
                    thNotify.send(msg, "danger");
                });
        }

        /**
         * Lines that haven't yet been saved.
         */
        $scope.pendingLines = lineFilterFunc(line => line.verified === false);

        /**
         * Lines that are selected
         */
        $scope.selectedLines = lineFilterFunc(line => ctrl.selectedLineIds.has(line.id));

        /**
         * Lines that can be selected
         */
        var selectableLines = lineFilterFunc(line => !line.verified);

        function lineFilterFunc(filterFunc) {
            return () => {
                if (!$scope.errorLines) {
                    return [];
                }
                return $scope.errorLines.filter(filterFunc);
            };
        }

        $rootScope.$on(thEvents.autoclassifyChangeSelection,
                       (ev, direction, clear) => ctrl.onChangeSelection(direction, clear));

        $rootScope.$on(thEvents.autoclassifySaveAll,
                       () => {
                           if ($scope.canSave($scope.pendingLines())) {
                               ctrl.onSaveAll();
                           } else {
                               var msg = ($scope.canClassify ? "lines not classified" :
                                       "Not logged in");
                               thNotify.send("Can't save: " + msg, "danger");
                           }
                       });

        $rootScope.$on(thEvents.autoclassifySave,
                       () => {
                           if ($scope.canSave($scope.selectedLines())) {
                               ctrl.onSave();
                           } else {
                               var msg = ($scope.canClassify ? "selected lines not classified" :
                                       "Not logged in");
                               thNotify.send("Can't save: " + msg, "danger");
                           }
                       });

        $rootScope.$on(thEvents.autoclassifyToggleEdit,
                       () => ctrl.onToggleEditable());

        $rootScope.$on(thEvents.autoclassifyOpenLogViewer,
                       () => ctrl.onOpenLogViewer());
    }
]);

treeherder.component('thAutoclassifyPanel', {
    template: panelTemplate,
    controller: 'ThAutoclassifyPanelController',
    bindings: {
        thJob: '<',
        hasLogs: '<',
        logsParsed: '<',
        logParseStatus: '<',
        autoclassifyStatus: '<',
        thUser: '<'
    }
});
