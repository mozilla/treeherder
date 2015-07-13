'use strict';

var bugsCache = {};
var hoverTimeout;

/* Filters */

treeherder.filter('showOrHide', function() {
    // determine whether this is a label for a job group (like mochitest)
    return function(input, isCollapsed) {
        if (isCollapsed === true) {
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
        var clear_attr = 'ignore-job-clear-on-click';

        var bug_matches = str.match(/-- ([0-9]+)|bug.([0-9]+)/ig);
        var pr_matches = str.match(/PR#([0-9]+)/ig);

        // Settings
        var bug_title = "Fetching bug details... Move cursor away and back again to show information.";
        var bug_url = '<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=$1" ' +
            'data-bugid=$1 title="' + bug_title + '" onmouseover="initMouseOver(this)" onmouseout="cancelMouseOver()">$1</a>';
        var pr_title = 'github.com';
        var pr_url = '<a href="https://github.com/mozilla-b2g/gaia/pull/$1" ' +
            'data-prid=$1 ' + 'title=' + pr_title + '>$1</a>';

        if (bug_matches) {
            // Separate passes to preserve prefix
            str = str.replace(/Bug ([0-9]+)/g, "Bug " + bug_url);
            str = str.replace(/bug ([0-9]+)/g, "bug " + bug_url);
            str = str.replace(/-- ([0-9]+)/g, "-- " + bug_url);
        }

        if (pr_matches) {
            // Separate passes to preserve prefix
            str = str.replace(/PR#([0-9]+)/g, "PR#" + pr_url);
            str = str.replace(/pr#([0-9]+)/g, "pr#" + pr_url);
        }

        return str;
    };
});

treeherder.filter('initials', function() {
    return function(input) {
        var str = input || '';
        var words = str.split(' ');
        var firstLetters = _.filter(_.map(words, function(word) { return word.replace(/[^A-Z]/gi, '')[0]; }));
        var initials = "";
        if (firstLetters.length === 1) {
            initials = firstLetters[0];
        } else if (firstLetters.length > 1) {
            initials = firstLetters[0] + firstLetters[firstLetters.length - 1];
        }
        return '<span class="label label-initials">' + initials + '</span>';
    };
});

function inTag(str, index, start, end) {
    var prePart = str.substr(0, index);
    return prePart.split(start).length > prePart.split(end).length;
}

treeherder.filter('highlightCommonTerms', function() {
    return function(input) {
        var compareStr = Array.prototype.slice.call(arguments, 1).filter(
            function(x) {return x;}).join(" ");
        var tokens = compareStr.split(/[^a-zA-Z0-9_-]+/);
        tokens.sort(function(a, b){
            return b.length - a.length;
        });

        angular.forEach(tokens, function(elem) {
            if (elem.length > 0) {
                input = input.replace(new RegExp("(^|\\W)(" + elem + ")($|\\W)", "gi"), function(match, prefix, token, suffix, index, str) {
                    if (inTag(str, index, "<", ">") || inTag(str, index, "&", ";")){
                        return match;
                    } else {
                        return prefix + "<strong>" + token + "</strong>" + suffix;
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

treeherder.filter('getRevisionUrl', ['thServiceDomain', function(thServiceDomain) {
    return function(revision, projectName) {
        if (revision) {
            return thServiceDomain + '/#/jobs?repo=' + projectName + '&revision=' + revision;
        }
        return '';
    };
}]);

treeherder.filter('alertStatus', [
    'phAlertSummaryResolutionMap', function(phAlertSummaryResolutionMap) {
        return function(resolutionId) {
            return phAlertSummaryResolutionMap[resolutionId];
        };
    }]);

//http://stackoverflow.com/questions/16630471/how-can-i-invoke-encodeuricomponent-from-angularjs-template
treeherder.filter('encodeURIComponent', function() {
    return window.encodeURIComponent;
});

/*
 * Given a bug id, fetch the status and summary from
 * bugzilla for use in tooltips on links to that bug.
 */
function initMouseOver(bugLink) {
    var bugsCacheEntry = bugsCache[bugLink.getAttribute("data-bugid")];
    if(bugsCacheEntry) {
        setTitleAndClearListeners(bugLink, bugsCacheEntry);
    } else {
        hoverTimeout = window.setTimeout(getBugInfo, 1000, bugLink);
    }
}

function cancelMouseOver() {
    window.clearTimeout(hoverTimeout);
}

function getBugInfo(bugLink) {
    var bugID = bugLink.getAttribute("data-bugid");
    var bugURL = 'https://bugzilla.mozilla.org/rest/bug/' + bugID + '?include_fields=status,summary';

    if(bugID) {
        // Fetch the bug information from bugzilla and store it locally
        $.getJSON(bugURL)
            .done(function(json) {
                var thisBug = json.bugs[0];
                bugsCache[bugID] = {
                    'status': thisBug.status,
                    'summary': thisBug.summary
                };
            })
            .fail(function(err) {
                if(err.status === 401) {
                    bugsCache[bugID] = {
                        'status': 'INACCESSIBLE',
                        'summary': "This bug failed to load."
                    };
                }
                if(err.status === 404) {
                    bugsCache[bugID] = {
                        'status': 'BUG NOT FOUND',
                        'summary': "This bug does not exist."
                    };
                }
            })
            .always(function() {
                setTitleAndClearListeners(bugLink, bugsCache[bugID]);
            });

    }
}

function setTitleAndClearListeners(bugLink, bugsCacheEntry) {
    bugLink.title = bugsCacheEntry.status + " - " + bugsCacheEntry.summary;
    bugLink.removeAttribute("onmouseover");
    bugLink.removeAttribute("onmouseout");
}
