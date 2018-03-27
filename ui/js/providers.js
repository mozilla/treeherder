import treeherder from './treeherder';
import * as aggregateIds from '../job-view/aggregateIds';


treeherder.provider('thAggregateIds', function () {
    this.$get = function () {
        return {
            getPlatformRowId: aggregateIds.getPlatformRowId,
            getPushTableId: aggregateIds.getPushTableId,
            getGroupMapKey: aggregateIds.getGroupMapKey,
            escape: aggregateIds.escape
        };
    };
});

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
