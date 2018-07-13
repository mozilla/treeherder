import $ from 'jquery';

import treeherder from '../../treeherder';
import thRepoMenuItemTemplate from '../../../partials/main/thRepoMenuItem.html';

treeherder.directive('thCheckboxDropdownContainer', function () {
        return {
            restrict: 'A',
            link: function (scope, element) {

                scope.closeable = true;
                $(element).on({
                    'hide.bs.dropdown': function () {
                        const closeable = scope.closeable;
                        scope.closeable = true;
                        return closeable;
                    },
                });

                $('.checkbox-dropdown-menu').on({
                    click: function (ev) {
                        if ($(ev.target).hasClass('dropdown-link') ||
                            $(ev.target).parent().hasClass('dropdown-link')) {
                            scope.closeable = false;
                        }
                    },
                });

            },
        };
    });

treeherder.directive('thRepoMenuItem',
    function () {
        return {
            restrict: 'E',
            replace: true,
            link: function (scope, element) {
                const elem = $(element);
                elem.find('.dropdown-link').prop('href', scope.urlBasePath + '?repo=' + scope.repo.name);
                if (scope.repo.name === scope.repoName) {
                    elem.find('.dropdown-checkbox').prop('disabled', 'disabled');
                }

            },
            template: thRepoMenuItemTemplate,
        };
    });
