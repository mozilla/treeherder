"use strict";

treeherder.factory('actionsRender', function () {
    const jsone = require('json-e');

    // this simply calls json-e at the moment, but exists as a service to allow
    // addition of more context items later.
    return (template, context) => jsone(template, context);
});
