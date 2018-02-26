//Directive blurThis which removes focus from a specific element
treeherder.directive('blurThis', ['$timeout', function ($timeout) {
    return function (scope, elem, attr) {
        scope.$on('blur-this', function (event, id) {
            if (attr.id === id) {
                $timeout(function () {
                    elem[0].blur();
                }, 0);
            }
        });
    };
}]);

// Directive focusMe which sets a global focus state for elements
// which listen to it via ''focus-me="focusInput'' in angular markup
treeherder.directive('focusMe', [
    '$timeout',
    function ($timeout) {
        return {
            link: function (scope, element, attrs) {
                scope.$watch(attrs.focusMe, function (value) {
                    if (value) {
                        $timeout(function () {
                            element[0].focus();
                        }, 0);
                    } else {
                        $timeout(function () {
                            element[0].blur();
                        }, 0);
                    }
                });
            }
        };
    }]);

// Allow copy to system clipboard during hover
treeherder.directive('copyValue', [
    function () {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                var cont = document.getElementById('clipboard-container'),
                    clip = document.getElementById('clipboard');
                element.on('mouseenter', function () {
                    cont.style.display = 'block';
                    clip.value = attrs.copyValue;
                    clip.focus();
                    clip.select();
                });
                element.on('mouseleave', function () {
                    cont.style.display = 'none';
                    clip.value = '';
                });
            }
        };
    }
]);

// Prevent default behavior on left mouse click. Useful
// for html anchor's that need to do in application actions
// on left click but default href type functionality on
// middle or right mouse click.
treeherder.directive('preventDefaultOnLeftClick', [
    function () {
        return {
            restrict: 'A',
            link: function (scope, element) {
                element.on('click', function (event) {
                    if (event.which === 1) {
                        event.preventDefault();
                    }
                    element.blur();
                });
            }
        };
    }
]);

treeherder.directive('stopPropagationOnLeftClick', [
    function () {
        return {
            restrict: 'A',
            link: function (scope, element) {
                element.on('click', function (event) {
                    if (event.which === 1) {
                        event.stopPropagation();
                    }
                });
            }
        };
    }
]);

treeherder.directive('thNotificationBox', [
    'thNotify',
    function (thNotify) {
        return {
            restrict: "E",
            templateUrl: "partials/main/thNotificationsBox.html",
            link: function (scope) {
                scope.notifier = thNotify;
                scope.alert_class_prefix = "alert-";
            }
        };
    }]);

treeherder.directive('thFaviconLink', [
    '$sce', 'ThRepositoryModel', 'thFavicons',
    function ($sce, ThRepositoryModel, thFavicons) {
        return {
            restrict: "E",
            link: function (scope) {
                scope.currentTreeStatus = ThRepositoryModel.getCurrentTreeStatus;
                scope.$watch('currentTreeStatus()', function (newVal) {
                    if (newVal) {
                        scope.favicon = $sce.trustAsResourceUrl(thFavicons[ThRepositoryModel.getCurrentTreeStatus()]);
                    }
                });
            },
            template: '<link id="favicon" type="image/png" rel="shortcut icon" href="{{favicon}}" />'
        };
    }]);

treeherder.directive('bugInput', function () {
    return {
        restrict: 'A',
        link: function (scope, elem) {
            elem.on('invalid', function (event) {
                event.target.setCustomValidity('Please enter a bug number');
            });
            elem.on('input', function (event) {
                event.target.setCustomValidity('');
                event.target.value = event.target.value.trim();
            });
            elem.attr('type', 'text');
            elem.attr('pattern', '\\s*\\d+\\s*');
        }
    };
});
