'use strict';
// Webpack entry point for admin.html
// Scripts and styles included here are automatically included on the page at build time

require('./js/config');

// Styles
require('bootstrap/dist/css/bootstrap.css');
require('font-awesome/css/font-awesome.css');
require('./css/treeherder-notifications.css');
require('./css/treeherder-admin.css');
require('./css/treeherder-navbar.css');

// Vendor JS
require('angular');
require('angular-resource');
require('angular-cookies');
require('angular-ui-router');
require('angular-sanitize');
require('angular-local-storage');
require('bootstrap/dist/js/bootstrap');
require('angular-ui-bootstrap');
require('mousetrap');
require('react-dom');
require('ngreact');
require('./vendor/angular-clipboard.js');

// Admin JS
require('./js/services/treestatus.js');
require('./js/providers.js');
require('./js/values.js');
require('./js/services/main.js');
require('./js/services/log.js');
require('./js/services/jsonpushes.js');
require('./js/models/repository.js');
require('./js/models/build_platform.js');
require('./js/models/exclusion_profile.js');
require('./js/models/job_exclusion.js');
require('./js/models/job_type.js');
require('./js/models/option_collection.js');
require('./js/models/user.js');
require('./js/models/error.js');
require('./js/components/auth.js');
require('./js/directives/treeherder/main.js');
require('./js/react/admin/reactselect.js');
require('./js/controllers/admin/admin.js');
require('./js/controllers/admin/exclusions_list.js');
require('./js/controllers/admin/exclusions_detail.js');
require('./js/controllers/admin/profiles_list.js');
require('./js/controllers/admin/profiles_detail.js');
