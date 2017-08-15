"use strict";

treeherder.factory('tcactions', [
    '$http', 'ThJobDetailModel', 'ThResultSetStore',
    function ($http, ThJobDetailModel, ThResultSetStore) {
        const jsone = require('json-e');

        return {
            render: (template, context) => jsone(template, context),
            load: (repoName, resultsetId, job) => {
                let decisionTask = ThResultSetStore.getGeckoDecisionJob(repoName, resultsetId);

                if (!decisionTask) {
                    alert("No decision task, can't find taskcluster actions");
                    return;
                }

                let originalTaskId = job.taskcluster_metadata.task_id;
                return $http.get('https://queue.taskcluster.net/v1/task/' + originalTaskId).then(
                    function (response) {
                        const originalTask = response.data;
                        return ThJobDetailModel.getJobDetails({
                            job_id: decisionTask.id,
                            title: 'artifact uploaded',
                            value: 'actions.json'}).then(function (details) {
                                if (!details.length) {
                                    alert("Could not find actions.json");
                                    return;
                                }

                                let actionsUpload = details[0];
                                return $http.get(actionsUpload.url).then(function (response) {
                                    if (response.data.version !== 1) {
                                        alert("Wrong version of actions.json, can't continue");
                                        return;
                                    }
                                    return {
                                        originalTask,
                                        staticActionVariables: response.data.variables,
                                        actions: response.data.actions.filter(function (action) {
                                            return action.kind === 'task' && (
                                                !action.context.length || _.some((action.context).map(function (actionContext) {
                                                    return !Object.keys(actionContext).length || _.every(_.map(actionContext, function (v, k) {
                                                        return (originalTask.tags[k] === v);
                                                    }));
                                                })));
                                        }),
                                    };
                                });
                            });
                    });
            },
        };
    }]);
