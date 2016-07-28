'use strict';

treeherder.directive('ngRightClick', [
    '$parse',
    function($parse) {
        return function(scope, element, attrs) {
            var fn = $parse(attrs.ngRightClick);
            element.bind('contextmenu', function(event) {
                scope.$apply(function() {
                    event.preventDefault();
                    fn(scope, {$event:event});
                });
            });
        };
    }]);

//Directive focusThis which applies focus to a specific element
treeherder.directive('focusThis', ['$timeout', function($timeout) {
    return function(scope, elem, attr) {
        scope.$on('focus-this', function(event, id) {
            if (attr.id === id) {
                $timeout(function() {
                    elem[0].focus();
                }, 0);
            }
        });
    };
}]);

//Directive blurThis which removes focus from a specific element
treeherder.directive('blurThis', ['$timeout', function($timeout) {
    return function(scope, elem, attr) {
        scope.$on('blur-this', function(event, id) {
            if (attr.id === id) {
                $timeout(function() {
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
    function($timeout) {
        return {
            link: function(scope, element, attrs) {
                scope.$watch(attrs.focusMe, function(value) {
                    if (value) {
                        $timeout(function() {
                            element[0].focus();
                        }, 0);
                    } else {
                        $timeout(function() {
                            element[0].blur();
                        }, 0);
                    }
                });
            }
        };
    }]);

// Allow copy to system clipboard during hover
treeherder.directive('copyValue', [
    function() {
        return {
            restrict: 'A',
            link: function(scope, element, attrs) {
                var cont = document.getElementById('clipboard-container'),
                    clip = document.getElementById('clipboard');
                element.on('mouseenter', function() {
                    cont.style.display = 'block';
                    clip.value = attrs.copyValue;
                    clip.focus();
                    clip.select();
                });
                element.on('mouseleave', function() {
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
    function() {
        return {
            restrict: 'A',
            link: function(scope, element){
                element.on('click', function(event) {
                    if (event.which === 1) {
                        event.preventDefault();
                    }
                });
            }
        };
    }
]);

treeherder.directive('stopPropagationOnLeftClick', [
    function() {
        return {
            restrict: 'A',
            link: function(scope, element) {
                element.on('click', function(event) {
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
    function(thNotify){
        return {
            restrict: "E",
            templateUrl: "partials/main/thNotificationsBox.html",
            link: function(scope) {
                scope.notifier = thNotify;
                scope.alert_class_prefix = "alert-";
            }
        };
    }]);

treeherder.directive('thFaviconLink', [
    'ThRepositoryModel', 'thFavicons',
    function(ThRepositoryModel, thFavicons){
        return {
            restrict: "E",
            link: function(scope) {
                scope.currentTreeStatus = ThRepositoryModel.getCurrentTreeStatus;
                scope.$watch('currentTreeStatus()', function(newVal) {
                    if (newVal) {
                        scope.favicon = thFavicons[ThRepositoryModel.getCurrentTreeStatus()];
                    }
                });
            },
            template: '<link id="favicon" type="image/png" rel="shortcut icon" href="{{favicon}}" />'
        };
    }]);

treeherder.directive('bugInput', function() {
    return {
        restrict: 'A',
        link: function(scope, elem) {
            elem.on('invalid', function(event) {
                event.target.setCustomValidity('Please enter a bug number');
            });
            elem.on('input', function(event) {
                event.target.setCustomValidity('');
                event.target.value = event.target.value.trim();
            });
            elem.attr('type', 'text');
            elem.attr('pattern', '\\s*\\d+\\s*');
        }
    };
});

treeherder.directive('numbersOnly', function(){
    return {
        require: 'ngModel',
        link: function(scope, element, attrs, modelCtrl) {
            modelCtrl.$parsers.push(function (inputValue) {
                // this next is necessary for when using ng-required on your input.
                // In such cases, when a letter is typed first, this parser will be called
                // again, and the 2nd time, the value will be undefined
                if (inputValue === undefined) return '';
                var transformedInput = inputValue.replace(/[^0-9]/g, '');
                if (transformedInput!==inputValue) {
                    modelCtrl.$setViewValue(transformedInput);
                    modelCtrl.$render();
                }

                return transformedInput;
            });
        }
    };
});

treeherder.directive("thMultiSelect", [
    '$log',
    function(){
        return {
            restrict: "E",
            templateUrl: "partials/main/thMultiSelect.html",
            scope: {
                leftList: "=",
                rightList: "="
            },
            link: function(scope){

                scope.leftSelected = [];
                scope.rightSelected = [];
                // move the elements selected from one list to the other
                var move_options = function(what, from, to){
                    var found;
                    for(var i=0;i<what.length; i++){
                        found = from.indexOf(what[i]);
                        if(found !== -1){
                            to.push(from.splice(found, 1)[0]);
                        }
                    }
                };
                scope.move_left = function(){
                    move_options(scope.rightSelected, scope.rightList, scope.leftList);
                };
                scope.move_right = function(){
                    move_options(scope.leftSelected, scope.leftList, scope.rightList);
                };
            }
        };
    }]);

treeherder.directive("thTruncatedList", [
    '$log',
    function(){
        // transforms a list of elements in a shortened list
        // with a "more" link
        return {
            restrict: "E",
            scope: {
                // number of visible elements
                numvisible: "@",
                elem_list: "=elements"
            },
            link: function(scope, element){
                scope.visible = parseInt(scope.numvisible);

                if(typeof scope.visible !== 'number'
                   || scope.visible < 0
                   || isNaN(scope.visible)){
                    throw new TypeError("The visible parameter must be a positive number");
                }
                // cloning the original list to avoid
                scope.$watch("elem_list", function(newValue){
                    if(newValue){
                        var elem_list_clone = angular.copy(newValue);
                        scope.visible = Math.min(scope.visible, elem_list_clone.length);
                        var visible_content = elem_list_clone.splice(0, scope.visible);
                        $(element[0]).empty();
                        $(element[0]).append(visible_content.join(", "));
                        if(elem_list_clone.length > 0){
                            $(element[0]).append(
                                $("<a></a>")
                                    .attr("title", elem_list_clone.join(", "))
                                    .text(" and "+ elem_list_clone.length+ " others")
                                    .tooltip()
                            );
                        }
                    }
                });
            }
        };
    }]);
