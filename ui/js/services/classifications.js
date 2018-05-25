import treeherder from '../treeherder';
import { getApiUrl } from '../../helpers/url';

treeherder.factory('thClassificationTypes', [
    '$http',
    function ($http) {

        const classifications = {};
        const classificationOptions = [];

        const classificationColors = {
            1: "", // not classified
            2: "label-info", // expected fail",
            3: "label-success", // fixed by backout",
            4: "label-warning", // intermittent",
            5: "label-default", // infra",
            6: "label-danger", // intermittent needs filing",
            7: "label-warning" // autoclassified intermittent
        };

        const addClassification = function (cl) {
            classifications[cl.id] = {
                name: cl.name,
                star: classificationColors[cl.id]
            };
            classificationOptions.push(cl);
        };

        const load = function () {
            return $http.get(getApiUrl("/failureclassification/"), { cache: true })
                .then(({ data }) => {
                    data.forEach(addClassification);
                });
        };

        return {
            classifications: classifications,
            classificationOptions: classificationOptions,
            load: load
        };
    }]);
