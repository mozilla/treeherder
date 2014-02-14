/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function($, window) {
    'use strict';

    // State? Ewwwwww.
    var logoutDeferred = null; // Deferred for post-logout actions.
    var requestDeferred = null; // Deferred for post-request actions.

    // Fetch browseridInfo via AJAX.
    var browseridInfo = $.get('/browserid/info/');

    // Public API
    window.django_browserid = {
        /**
         * Retrieve an assertion and use it to log the user into your site.
         * @param {object} requestArgs Options to pass to navigator.id.request.
         * @return {jQuery.Deferred} Deferred that resolves once the user has
         *                           been logged in.
         */
        login: function login(requestArgs) {
            return django_browserid.getAssertion(requestArgs).then(function(assertion) {
                return django_browserid.verifyAssertion(assertion);
            });
        },

        /**
         * Log the user out of your site.
         * @return {jQuery.Deferred} Deferred that resolves once the user has
         *                           been logged out.
         */
        logout: function logout() {
            return browseridInfo.then(function(info) {
                logoutDeferred = $.Deferred();
                navigator.id.logout();

                return logoutDeferred.then(function() {
                    return $.ajax(info.logoutUrl, {
                        type: 'POST',
                        headers: {'X-CSRFToken': info.csrfToken},
                    });
                });
            });
        },

        /**
         * Retrieve an assertion via BrowserID.
         * @param {object} requestArgs Options to pass to navigator.id.request.
         * @return {jQuery.Deferred} Deferred that resolves with the assertion
         *                           once it is retrieved.
         */
        getAssertion: function getAssertion(requestArgs) {
            return browseridInfo.then(function(info) {
                requestArgs = $.extend({}, info.requestArgs, requestArgs);

                requestDeferred = $.Deferred();
                navigator.id.request(requestArgs);
                return requestDeferred;
            });
        },

        /**
         * Verify that the given assertion is valid, and log the user in.
         * @param {string} Assertion to verify.
         * @return {jQuery.Deferred} Deferred that resolves with the login view
         *                           response once login is complete.
         */
        verifyAssertion: function verifyAssertion(assertion) {
            return browseridInfo.then(function(info) {
                return $.ajax(info.loginUrl, {
                    type: 'POST',
                    data: {assertion: assertion},
                    headers: {'X-CSRFToken': info.csrfToken},
                });
            });
        }
    };

    $(function() {
        var loginFailed = location.search.indexOf('bid_login_failed=1') !== -1;

        // Trigger login whenever a login link is clicked, and redirect the user
        // once it succeeds.
        $(document).on('click', '.browserid-login', function(e) {
            e.preventDefault();
            var $link = $(this);
            django_browserid.login().then(function(verifyResult) {
                window.location = $link.data('next') || verifyResult.redirect;
            });
        });

        // Trigger logout whenever a logout link is clicked, and redirect the
        // user once it succeeds.
        $(document).on('click', '.browserid-logout', function(e) {
            e.preventDefault();
            var $link = $(this);
            django_browserid.logout().then(function(logoutResult) {
                window.location = $link.attr('next') || logoutResult.redirect;
            });
        });

        browseridInfo.then(function(info) {
            navigator.id.watch({
                loggedInUser: info.userEmail,
                onlogin: function(assertion) {
                    // Avoid auto-login on failure.
                    if (loginFailed) {
                        navigator.id.logout();
                        loginFailed = false;
                        return;
                    }

                    if (requestDeferred) {
                        requestDeferred.resolve(assertion);
                    }
                },
                onlogout: function() {
                    if (logoutDeferred) {
                        logoutDeferred.resolve();
                    }
                }
            });
        });
    });
})(jQuery, window);
