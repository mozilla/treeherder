import _ from 'lodash';

import treeherderApp from '../treeherder_app';
import { thTitleSuffixLimit, thDefaultRepo } from '../../helpers/constants';
import { getUrlParam } from '../../helpers/location';

treeherderApp.controller('MainCtrl', [
    '$scope', '$rootScope', 'ThResultSetStore', 'thNotify',
    function MainController(
        $scope, $rootScope, ThResultSetStore, thNotify) {

        if (window.navigator.userAgent.indexOf('Firefox/52') !== -1) {
          thNotify.send('Firefox ESR52 is not supported. Please update to ESR60 or ideally release/beta/nightly.',
                        'danger', { sticky: true });
        }

        // set to the default repo if one not specified
        const repoName = getUrlParam('repo');
        if (repoName) {
            $rootScope.repoName = repoName;
        } else {
            $rootScope.repoName = thDefaultRepo;
        }

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

        $rootScope.onscreenOverlayShowing = false;

        $rootScope.onscreenShortcutsShowing = false;
        $rootScope.setOnscreenShortcutsShowing = function (tf) {
            $rootScope.onscreenShortcutsShowing = tf;
            $rootScope.onscreenOverlayShowing = tf;
        };
    },
]);
