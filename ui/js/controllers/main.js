import _ from 'lodash';

import treeherderApp from '../treeherder_app';
import { thTitleSuffixLimit, thDefaultRepo } from '../../helpers/constants';
import { getUrlParam } from '../../helpers/location';

treeherderApp.controller('MainCtrl', [
    '$scope', '$rootScope',
    function MainController(
        $scope, $rootScope) {

        // set to the default repo if one not specified
        const repoName = getUrlParam('repo');
        if (repoName) {
            $rootScope.repoName = repoName;
        } else {
            $rootScope.repoName = thDefaultRepo;
        }

        $rootScope.firstPush = null;

        const getSingleRevisionTitleString = function () {
            let revisions = [];
            let percentComplete;

            if ($scope.currentRepo && $rootScope.firstPush) {
                revisions = $rootScope.firstPush.revisions;
            }

            // Revisions (and comments) might not be loaded the first few times this function is called
            if (revisions.length === 0 || !revisions[0].comments) {
                return [false, false];
            }

            // when addressing Bug 1450042, don't need to set ``jobCounts``
            // on each push anymore.
            if ($rootScope.firstPush.jobCounts) {
                const { pending, running, completed } = $rootScope.firstPush.jobCounts;
                const total = completed + pending + running;
                percentComplete = total > 0 ?
                  Math.floor(((completed / total) * 100)) : 0;
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
            const ufc = $rootScope.unclassifiedFailureCount;
            const revision = getUrlParam('revision');

            // repoName is undefined for the first few title update attempts, show something sensible
            let title = '[' + ufc + '] ' + ($rootScope.repoName ? $rootScope.repoName : 'Treeherder');

            if (revision) {
                const desc = getSingleRevisionTitleString();
                const revtitle = desc[0] ? ': ' + desc[0] : '';
                const percentage = desc[1] ? desc[1] + '% - ' : '';

                title = percentage + title + revtitle;
            }
            return title;
        };

        $rootScope.unclassifiedFailureCount = 0;
        $rootScope.onscreenOverlayShowing = false;

        $rootScope.onscreenShortcutsShowing = false;
        $rootScope.setOnscreenShortcutsShowing = function (tf) {
            $rootScope.onscreenShortcutsShowing = tf;
            $rootScope.onscreenOverlayShowing = tf;
        };
    },
]);
