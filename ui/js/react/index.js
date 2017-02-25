'use strict';
const RevisionList = require('./treeherder/revision-list').RevisionList;

treeherder.directive('revisionList', ['reactDirective', '$injector', (reactDirective, $injector) =>
    reactDirective(RevisionList, undefined, {}, {$injector})]);
