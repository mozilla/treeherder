'use strict';

/* Filters */

treeherder.filter('showOrHide', function() {
    // determine whether this is a label for a job group (like mochitest)
    return function(input, isCollapsed) {
        if (isCollapsed == true) {
            return "show" + input;
        } else {
            return "hide" + input;
        }
    };
});

treeherder.filter('platformName', function() {
    // fix the platform name from the raw name in the db, with the more
    // "human read-able" one from Config.js
    return function(input, name) {
            var newName = Config.OSNames[name];
            if (newName) {
                return newName;
            }
            // if it's not found in Config.js, then return it unchanged.
            return name;
    };
});

treeherder.filter('stripHtml', function() {
    return function(input) {
        var str = input || '';
        return str.replace(/<\/?[^>]+>/gi, '');
    };
});

treeherder.filter('linkifyBugs', function() {
    return function(input) {
        var re = new RegExp('(?:Bug (\\d+))', 'ig');
        var str = input || '';
        return str.replace(re,
            '<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=$1" target="_blank">Bug $1</a>'
        );
    };
});

function inTag(str, index, start, end) {
    var prePart = str.substr(0, index);
    return prePart.split(start).length > prePart.split(end).length;
}

treeherder.filter('highlightCommonTerms', function(){
    return function(input, compareStr){
        var tokens = compareStr.split(/[^a-zA-Z0-9_-]+/);
        tokens.sort(function(a, b){
            return b.length - a.length;
        });
        angular.forEach(tokens, function(elem){
            if (elem.length > 0){
                input = input.replace(new RegExp(elem, "gi"), function(token, index, str){
                    if (inTag(str, index, "<", ">") || inTag(str, index, "&", ";")){
                        return token;
                    }else{
                        return "<strong>"+token+"</strong>";
                    }
                });
            }
        });
        return input;
    };
});

treeherder.filter('escapeHTML', function() {
    return function(text){
        if (text) {
        return text.
            replace(/&/g, '&amp;').
            replace(/</g, '&lt;').
            replace(/>/g, '&gt;').
            replace(/'/g, '&#39;').
            replace(/"/g, '&quot;');
        }
        return '';
    };
});
