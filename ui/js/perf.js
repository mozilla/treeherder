"use strict";

// ui.router.state.events polyfills the legacy ui-router $stateChange events:
// https://ui-router.github.io/guide/ng1/migrate-to-1_0#state-change-events
module.exports = angular.module("perf", ['ui.router', 'ui.router.state.events', 'ui.bootstrap', 'treeherder', 'angular-clipboard']);
