import treeherder from './treeherder';

treeherder.provider('thReftestStatus', function () {
    this.$get = function () {
        return function (job) {
            if (job.job_group_name) {
                return (job.job_group_name.toLowerCase().indexOf('reftest') !== -1 ||
                        job.job_type_name.toLowerCase().indexOf('reftest') !== -1);
            }
        };
    };
});
