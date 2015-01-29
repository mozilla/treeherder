/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

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

treeherder.filter('platformName', ['thPlatformNameMap', function(thPlatformNameMap) {
    // fix the platform name from the raw name in the db, with the more
    // "human read-able" one
    return function(input, name) {
            var newName = platformNameMap[name];
            if (newName) {
                return newName;
            }
            // if it's not found, then return it unchanged.
            return name;
    };
}]);

treeherder.filter('stripHtml', function() {
    return function(input) {
        var str = input || '';
        return str.replace(/<\/?[^>]+>/gi, '');
    };
});

treeherder.filter('linkifyBugs', function() {
    return function(input) {
        var str = input || '';
        var bug_matches = /.*-- ([0-9]+)|.*bug-([0-9]+)|.*Bug ([0-9]+)/ig.exec(str);
        var pr_matches = /PR#([0-9]+)/i.exec(str);
        if (pr_matches) {
            var pr_url = "https://github.com/mozilla-b2g/gaia/pull/" + pr_matches[1];
            var pr_hyperlink = '<a href="' + pr_url + '">' + pr_matches[1] + '</a>';
            str = str.replace(pr_matches[1], pr_hyperlink);
        }
        if (bug_matches) {
            var bug_match = bug_matches[1] || bug_matches[2] || bug_matches[3];
            var bug_url = "https://bugzilla.mozilla.org/show_bug.cgi?id=" + bug_match;
            var bug_hyperlink = '<a href="' + bug_url + '">' + bug_match + '</a>';
            str = str.replace(bug_match, bug_hyperlink);
        }
        return str;
    };
});

treeherder.filter('initials', function() {
    return function(input) {
        var str = input || '';
        var words = str.split(' ');
        var first = words[0].replace(/[^A-Z]/gi, '')[0];
        var last = words.slice(-1)[0].replace(/[^A-Z]/gi, '')[0];
        var initials = first + last;

        return '<span class="label label-initials">' + initials + '</span>';
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
