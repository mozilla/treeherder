// This is a run block which, when used on an angular module, loads all
// of the partials in /ui/partials and /ui/plugins into the Angular
// template cache. This means that ng-includes and templateUrls will not
// actually need to request a partial file at any point. See:
// https://github.com/dmachat/angular-webpack-cookbook/wiki/Angular-Template-Cache

// TODO: See if there's a way to avoid adding all partials to every page, that
// importantly also works for ng-includes. Perhaps one of these would work:
//  - https://github.com/teux/ng-cache-loader
//  - https://github.com/WearyMonkey/ngtemplate-loader
//  - https://github.com/EJIqpEP/angular-templatecache-loader
module.exports = ['$templateCache', ($templateCache) => {
    const partialsReq = require.context('../partials', true, /\.html$/);
    partialsReq.keys().forEach((template) => {
        const keyPath = `partials${template.substring(1)}`;
        $templateCache.put(
            keyPath,
            partialsReq(template)
        );
    });
    const pluginsReq = require.context('../plugins', true, /\.html$/);
    pluginsReq.keys().forEach((template) => {
        const keyPath = `plugins${template.substring(1)}`;
        $templateCache.put(
            keyPath,
            pluginsReq(template)
        );
    });
}];
