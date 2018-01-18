'use strict';

// Webpack entry point for login.html
// Scripts and styles included here are automatically included on the page at build time
import './js/config';

// Styles
import 'font-awesome/css/font-awesome.css';

// Vendor JS
import 'angular';
import 'angular-local-storage';
import 'auth0-js';
import 'angular-auth0';
import 'ngreact';

// Auth JS
import './js/services/auth.js';
import './js/components/auth/auth.jsx';
