import $ from 'jquery';
import _ from 'lodash';
import Mousetrap from 'mousetrap';

import treeherderApp from '../treeherder_app';
import {
  thTitleSuffixLimit, thDefaultRepo, thJobNavSelectors, thEvents,
} from '../constants';

treeherderApp.controller('MainCtrl', [
    '$scope', '$rootScope', '$location', '$timeout',
    'ThRepositoryModel', '$document',
    'thClassificationTypes', '$window',
    'thJobFilters', 'ThResultSetStore', 'thNotify',
    function MainController(
        $scope, $rootScope, $location, $timeout,
        ThRepositoryModel, $document,
        thClassificationTypes, $window,
        thJobFilters, ThResultSetStore, thNotify) {

        if (window.navigator.userAgent.indexOf('Firefox/52') !== -1) {
          thNotify.send('Firefox ESR52 is not supported. Please update to ESR60 or ideally release/beta/nightly.',
                        'danger', { sticky: true });
        }

        // set to the default repo if one not specified
        const repoName = $location.search().repo;
        if (repoName) {
            $rootScope.repoName = repoName;
        } else {
            $rootScope.repoName = thDefaultRepo;
            $location.search('repo', $rootScope.repoName);
        }
        $rootScope.revision = $location.search().revision;
        thClassificationTypes.load();

        // TODO: Remove this when pinnedJobs is converted to a model or Context
        $rootScope.countPinnedJobs = () => 0;

        const getSingleRevisionTitleString = function () {
            let revisions = [];
            let percentComplete;

            if ($scope.currentRepo && ThResultSetStore.getPushArray()[0]) {
                revisions = ThResultSetStore.getPushArray()[0].revisions;
            }

            // Revisions (and comments) might not be loaded the first few times this function is called
            if (revisions.length === 0 || !revisions[0].comments) {
                return [false, false];
            }

            // Job counts are calculated at a later point in the page load, so this is undefined for a while
            if (ThResultSetStore.getPushArray()[0].job_counts) {
                percentComplete = ThResultSetStore.getPushArray()[0].job_counts.percentComplete;
            }

            let title;
            for (let i = 0; i < revisions.length; i++) {
                title = _.unescape(revisions[i].comments);

                /*
                 *  Strip out unwanted things like additional lines, trychooser
                 *  syntax, request flags, mq cruft, whitespace, and punctuation
                 */
                title = title.split('\n')[0];
                title = title.replace(/\btry: .*/, '');
                title = title.replace(/\b(r|sr|f|a)=.*/, '');
                title = title.replace(/(imported patch|\[mq\]:) /, '');
                title = title.replace(/[;,\-\. ]+$/, '').trim();
                if (title) {
                    if (title.length > thTitleSuffixLimit) {
                        title = title.substr(0, thTitleSuffixLimit - 3) + '...';
                    }
                    break;
                }
            }
            return [title, percentComplete];
        };

        $rootScope.getWindowTitle = function () {
            const ufc = ThResultSetStore.getAllUnclassifiedFailureCount();
            const params = $location.search();

            // repoName is undefined for the first few title update attempts, show something sensible
            let title = '[' + ufc + '] ' + ($rootScope.repoName ? $rootScope.repoName : 'Treeherder');

            if (params.revision) {
                const desc = getSingleRevisionTitleString();
                const revtitle = desc[0] ? ': ' + desc[0] : '';
                const percentage = desc[1] ? desc[1] + '% - ' : '';

                title = percentage + title + revtitle;
            }
            return title;
        };

        // Setup key event handling
        const stopOverrides = new Map();

        Mousetrap.stopCallback = function (ev, element, combo) {
            // if the element has the class "mousetrap" then no need to stop
            if (element.classList.contains('mousetrap')) {
                return false;
            }

            // If the bug filer is opened, don't let these shortcuts work
            if ($document[0].body.classList.contains('filer-open')) {
                return true;
            }
            const overrideFunc = stopOverrides.get(combo);
            if (overrideFunc) {
                const override = overrideFunc(ev, element, combo);
                if (override !== null) {
                    return override;
                }
            }
            if ((element.tagName === 'INPUT' &&
                 element.type !== 'radio' && element.type !== 'checkbox') ||
                element.tagName === 'SELECT' ||
                element.tagName === 'TEXTAREA' ||
                element.isContentEditable || ev.keyCode === 16) {
                return true;
            }
            return false;
        };

        // Keep these in alphabetical order so we don't accidentally introduce
        // conflicts.
        const keyShortcuts = [
            // Shortcut: select all remaining unverified lines on the current job
            ['a', () => {
                $scope.$evalAsync($rootScope.$emit(thEvents.autoclassifyChangeSelection,
                                                   'all_next',
                                                   false));
            }],

            // Shortcut: pin selected job to pinboard and add a related bug
            ['b', (ev) => {
                if ($scope.selectedJob) {
                    $rootScope.$emit(thEvents.addRelatedBug,
                                     $rootScope.selectedJob);

                    // Prevent shortcut key overflow during focus
                    ev.preventDefault();

                    $timeout(
                        () => {
                            $('#related-bug-input').focus();
                        }, 0);
                }
            }, (ev, element) => {
                if (element.id === 'pinboard-classification-select') {
                    return false;
                }
                return null;
            }],

            // Shortcut: pin selected job to pinboard and enter classification
            ['c', (ev) => {
                if ($scope.selectedJob) {
                    $scope.$evalAsync(
                        $rootScope.$emit(thEvents.jobPin, $rootScope.selectedJob),
                    );

                    // Prevent shortcut key overflow during focus
                    ev.preventDefault();

                    $timeout(
                        () => {
                            $('#classification-comment').focus();
                        }, 0);
                }
            }, (ev, element) => {
                if (element.id === 'pinboard-classification-select') {
                    return false;
                }
                return null;
            }],

            // Shortcut: toggle edit mode for selected lines
            ['e', () => {
                $scope.$evalAsync($rootScope.$emit(thEvents.autoclassifyToggleEdit));
            }],

            // Shortcut: enter a quick filter
            ['f', (ev) => {
                // Prevent shortcut key overflow during focus
                ev.preventDefault();
                $('#quick-filter').focus();
            }],

            // Shortcut: clear the quick filter field
            ['ctrl+shift+f', (ev) => {
                // Prevent shortcut key overflow during focus
                ev.preventDefault();
                $scope.$evalAsync(thJobFilters.removeFilter('searchStr'));
            }],

            // Shortcut: toggle display in-progress jobs (pending/running)
            ['i', () => {
                $scope.$evalAsync(thJobFilters.toggleInProgress());
            }],

            // Shortcut: ignore selected in the autoclasify panel
            ['shift+i', () => {
                $scope.$evalAsync($rootScope.$emit(thEvents.autoclassifyIgnore));
            }],

            // Shortcut: select next unclassified failure
            [['j', 'n'], () => {
                $rootScope.$emit(thEvents.changeSelection,
                                 'next',
                                 thJobNavSelectors.UNCLASSIFIED_FAILURES);
            }],

            // Shortcut: select next unverified log line
            [['down', 'shift+down'], (ev) => {
                $scope.$evalAsync($rootScope.$emit(thEvents.autoclassifyChangeSelection,
                                                   'next',
                                                   !ev.shiftKey));
            }],

            // Shortcut: select previous unclassified failure
            [['k', 'p'], () => {
                $rootScope.$emit(thEvents.changeSelection,
                                 'previous',
                                 thJobNavSelectors.UNCLASSIFIED_FAILURES);
            }],

            // Shortcut: select previous unverified log line
            [['up', 'shift+up'], (ev) => {
                $scope.$evalAsync($rootScope.$emit(thEvents.autoclassifyChangeSelection,
                                                   'previous',
                                                   !ev.shiftKey));
            }],

            // Shortcut: open the logviewer for the selected job
            ['l', () => {
                $scope.$evalAsync($rootScope.$emit(thEvents.openLogviewer));
            }],

            // Shortcut: Next/prev unclassified failure
            // For 'n' and 'p', see 'j' and 'k' above

            // Shortcut: retrigger selected job
            ['r', () => {
                if ($scope.selectedJob) {
                    $scope.$evalAsync(
                        $rootScope.$emit(thEvents.jobRetrigger,
                                         $rootScope.selectedJob),
                    );
                }
            }],

            // Shortcut: save all in the autoclasify panel
            ['s', () => {
                $scope.$evalAsync($rootScope.$emit(thEvents.autoclassifySaveAll));
            }],

            // Shortcut: select next job tab
            ['t', () => {
                if ($scope.selectedJob) {
                    $scope.$evalAsync(
                        $rootScope.$emit(thEvents.selectNextTab),
                    );
                }
            }],

            // Shortcut: display only unclassified failures
            ['u', () => {
                $scope.$evalAsync(thJobFilters.toggleUnclassifiedFailures);
            }],

            // Shortcut: clear the pinboard
            ['ctrl+shift+u', () => {
                $scope.$evalAsync($rootScope.$emit(thEvents.clearPinboard));
            }],

            // Shortcut: toggle more/fewer options in the autoclassify panel
            ['x', () => {
                $scope.$evalAsync($rootScope.$emit(thEvents.autoclassifyToggleExpandOptions));
            }],

            // Shortcut: ignore selected in the autoclasify panel
            [['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'o'], (ev) => {
                $scope.$evalAsync($rootScope.$emit(thEvents.autoclassifySelectOption,
                                                   ev.key === 'o' ? 'manual' : ev.key));
            }],

            // Shortcut: select previous job
            ['left', () => {
                $rootScope.$emit(thEvents.changeSelection,
                                 'previous',
                                 thJobNavSelectors.ALL_JOBS);
            }],

            // Shortcut: select next job
            ['right', () => {
                $rootScope.$emit(thEvents.changeSelection,
                                 'next',
                                 thJobNavSelectors.ALL_JOBS);
            }],

            // Shortcut: pin selected job to pinboard
            ['space', (ev) => {
                // If a job is selected add it otherwise
                // let the browser handle the spacebar
                if ($scope.selectedJob) {
                    // Prevent page down propagating to the jobs panel
                    ev.preventDefault();

                    $scope.$evalAsync(
                        $rootScope.$emit(thEvents.jobPin, $rootScope.selectedJob),
                    );
                }
            }],

            // Shortcut: escape closes any open panels and clears selected job
            ['escape', () => {
                $scope.$evalAsync($rootScope.$emit(thEvents.clearSelectedJob));
                $scope.$evalAsync($scope.setOnscreenShortcutsShowing(false));
            }],

            // Shortcut: save pinboard classification and related bugs
            ['ctrl+enter', () => {
                $scope.$evalAsync($rootScope.$emit(thEvents.saveClassification));
            }, () => (
                // Make this work regardless of form controls etc.
                false
            )],

            // Shortcut: delete classification and related bugs
            ['ctrl+backspace', () => {
                if ($scope.selectedJob) {
                    $scope.$evalAsync($rootScope.$emit(thEvents.deleteClassification));
                }
            }],

            // Shortcut: display onscreen keyboard shortcuts
            ['?', () => {
                $scope.$evalAsync($scope.setOnscreenShortcutsShowing(true));
            }],
        ];

        keyShortcuts.forEach(function (data) {
            Mousetrap.bind(data[0], data[1]);
            if (data[2]) {
                let keys = data[0];
                if (!Array.isArray(keys)) {
                    keys = [keys];
                }
                keys.forEach(function (key) {
                    stopOverrides.set(key, data[2]);
                });
            }
        });

        const getNewReloadTriggerParams = function () {
            const locationSearch = $location.search();
            return ThResultSetStore.reloadOnChangeParameters.reduce(
                (acc, prop) => (locationSearch[prop] ? { ...acc, [prop]: locationSearch[prop] } : acc), {});
        };

        $scope.cachedReloadTriggerParams = getNewReloadTriggerParams();

        // reload the page if certain params were changed in the URL.  For
        // others, such as filtering, just re-filter without reload.

        // the param ``skipNextPageReload`` will cause a single run through
        // this code to skip the page reloading even on a param that would
        // otherwise trigger a page reload.  This is useful for a param that
        // is being changed by code in a specific situation as opposed to when
        // the user manually edits the URL location bar.
        $rootScope.$on('$locationChangeSuccess', function () {

            // used to test for display of watched-repo-navbar
            $rootScope.locationPath = $location.path().replace('/', '');

            const newReloadTriggerParams = getNewReloadTriggerParams();
            // if we are just setting the repo to the default because none was
            // set initially, then don't reload the page.
            const defaulting = newReloadTriggerParams.repo === thDefaultRepo &&
                             !$scope.cachedReloadTriggerParams.repo;

            if (!defaulting && $scope.cachedReloadTriggerParams &&
                !_.isEqual(newReloadTriggerParams, $scope.cachedReloadTriggerParams) &&
                !$rootScope.skipNextPageReload) {
                $window.location.reload();
            } else {
                $scope.cachedReloadTriggerParams = newReloadTriggerParams;
            }
            $rootScope.skipNextPageReload = false;

        });

        $scope.onscreenOverlayShowing = false;

        $scope.onscreenShortcutsShowing = false;
        $scope.setOnscreenShortcutsShowing = function (tf) {
            $scope.onscreenShortcutsShowing = tf;
            $scope.onscreenOverlayShowing = tf;
        };
    },
]);
