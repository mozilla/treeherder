"use strict";

treeherder.controller('TinderboxPluginCtrl',
    function TinderboxPluginCtrl($scope, $rootScope, $log, ThJobArtifactModel) {
        var logId = this.constructor.name;

        $log.debug(logId, "Tinderbox plugin initialized");
        var update_job_info = function(newValue, oldValue){
            $scope.tinderbox_lines = [];
            $scope.tinderbox_lines_parsed = [];
            $scope.tabs.tinderbox.num_items = 0;
            if(newValue){
                $scope.tabs.tinderbox.is_loading = true;
                ThJobArtifactModel.get_list({
                    name: "Job Info",
                    "type": "json",
                    job_id: newValue
                })
                .then(function(data){
                    // ``artifacts`` is set as a result of a promise, so we must have
                    // the watch have ``true`` as the last param to watch the value,
                    // not just the reference.  We also must check for ``blob`` in ``Job Info``
                    // because ``Job Info`` can exist without the blob as the promise is
                    // fulfilled.
                    if (data.length === 1 && _.has(data[0], 'blob')){

                        $scope.tinderbox_lines = data[0].blob.tinderbox_printlines;
                        for(var i=0; i<$scope.tinderbox_lines.length; i++){
                            var line = $scope.tinderbox_lines[i];
                            if(line.indexOf("<a href='http://graphs.mozilla.org") === 0){
                                continue;
                            }
                            var title = line;
                            var value = "";
                            var link = "";
                            var type = "";

                            var seps = [": ", "<br/>"];
                            var sep = false;

                            for(var j=0; j<seps.length; j++){
                                if(line.indexOf(seps[j]) !== -1){
                                    sep = seps[j];
                                }
                            }
                            if(sep){
                                var chunks = line.split(sep);
                                title = chunks[0];
                                value = chunks.slice(1).join(sep);
                                if(title.indexOf("link") !== -1){
                                    link = value;
                                    type = "link";
                                }
                                if(title === "TalosResult"){
                                    type = "TalosResult";
                                    // unescape the json string
                                    value =  value.replace(/\\/g, '');
                                    value = angular.fromJson(value);
                                }
                                if(sep === "<br/>" || sep.indexOf("<") !== -1){
                                    type="raw_html";
                                }
                            }else{
                                var uploaded_to_regexp = /\s*Uploaded\s+([A-Za-z\/\.0-9\-_]+)\s+to\s+(http:\/\/[A-Za-z\/\.0-9\-_]+)\s*/g;
                                var uploaded_to_chunks = uploaded_to_regexp.exec(title);
                                if(uploaded_to_chunks !== null){
                                    title = "artifact uploaded";
                                    value = uploaded_to_chunks[1];
                                    link = uploaded_to_chunks[2];
                                    type = "link";
                                }
                            }



                            $scope.tinderbox_lines_parsed.push({
                                title:title,
                                value:value,
                                link:link,
                                type: type
                            });
                        }
                    }
                    $scope.tabs.tinderbox.num_items = $scope.tinderbox_lines_parsed.length;

                })
                .finally(function(){
                    $scope.tabs.tinderbox.is_loading = false;
                });
            }
        };
        $scope.$watch("job.id", update_job_info, true);
    }
);
