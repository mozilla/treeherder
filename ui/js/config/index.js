'use strict';

// Check for a config file and use it if available
try {
    // (Requiring via context allows us to avoid ugly warnings when no file is present)
    const req = require.context('./', false, /^.*\.js/);
    if (req.keys().indexOf('./local.conf.js') > -1) {
        req('./local.conf.js');
    }
} catch (e) {
    // Ignore errors
}
