'use strict';

// This is a run block which, when used on an angular module, loads all
// of the partials in /ui/partials and /ui/plugins into the Angular
// template cache. This means that ng-includes and templateUrls will not
// actually need to request a partial file at any point.
module.exports = ['$templateCache', ($templateCache) => {
    const partialsReq = require.context('../partials', true, /\.(tmpl|html)$/);
    partialsReq.keys().forEach((template) => {
        const keyPath = `partials${template.substring(1)}`;
        $templateCache.put(
            keyPath,
            partialsReq(template)
        );
    });
    const pluginsReq = require.context('../plugins', true, /\.(tmpl|html)$/);
    pluginsReq.keys().forEach((template) => {
        const keyPath = `plugins${template.substring(1)}`;
        $templateCache.put(
            keyPath,
            pluginsReq(template)
        );
    });
}];
