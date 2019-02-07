import treeherder from '../../treeherder';
import compareErrorTemplate from '../../../partials/perf/comparerror.html';

treeherder.component('compareError', {
    template: compareErrorTemplate,
    bindings: {
        errors: '<',
        originalProject: '<',
        originalRevision: '<',
        newProject: '<',
        newRevision: '<',
    },
});
