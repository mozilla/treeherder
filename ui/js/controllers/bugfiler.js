"use strict";

treeherder.controller('BugFilerCtrl', [
    '$scope', '$rootScope', '$uibModalInstance', '$http', 'summary', 'thBugzillaProductObject',
    'thPinboard', 'thEvents', 'fullLog', 'parsedLog', 'reftest', 'selectedJob', 'allFailures',
    'thNotify', 'ThLog',
    function BugFilerCtrl(
        $scope, $rootScope, $uibModalInstance, $http, summary, thBugzillaProductObject,
        thPinboard, thEvents, fullLog, parsedLog, reftest, selectedJob, allFailures,
        thNotify, ThLog) {

        var $log = new ThLog("BugFilerCtrl");

        /**
         *  'enter' from the product search input should initiate the search
         */
        $scope.productSearchEnter = function(ev) {
            if (ev.keyCode === 13) {
                $scope.findProduct();
            }
        };

        /*
         **
         */
        $scope.isReftest = function() {
            return reftest !== "";
        };

        /**
         *  Pre-fill the form with information/metadata from the failure
         */
        $scope.initiate = function() {
            $uibModalInstance.parsedSummary = $uibModalInstance.parseSummary(summary);

            $scope.modalSummary = "Intermittent " + $uibModalInstance.parsedSummary[0].join(" | ");

            $("#modalParsedLog").next().attr("href", parsedLog);
            $("#modalFullLog").next().attr("href", fullLog);
            if ($scope.isReftest()) {
                $("#modalReftestLog").next().attr("href", reftest);
            }

            var thisFailure = "";
            for(var i = 0; i < allFailures.length; i++) {
                var omittedLeads = ["TEST-UNEXPECTED-FAIL", "PROCESS-CRASH", "TEST-UNEXPECTED-ERROR", "TEST-UNEXPECTED-TIMEOUT"];
                for(var j=0; j < omittedLeads.length; j++) {
                    if(allFailures[i][0].search(omittedLeads[j]) >= 0) {
                        allFailures[i].shift();
                    }
                }
                if(i !== 0) {
                    thisFailure += "\n";
                }
                thisFailure += allFailures[i].join(" | ");
                $("#modalFailureList");
            }
            $("#modalFailureList").val(thisFailure);

            $scope.findProduct();
        };

        $uibModalInstance.parsedSummary = "";
        $uibModalInstance.initiate = $scope.initiate;
        $uibModalInstance.possibleFilename = "";

        /*
         *  Remove extraneous junk from the start of the summary line
         *  and try to find the failing test name from what's left
         */
        $uibModalInstance.parseSummary = function(summary) {
            var omittedLeads = ["TEST-UNEXPECTED-FAIL", "PROCESS-CRASH", "TEST-UNEXPECTED-ERROR", "TEST-UNEXPECTED-TIMEOUT"];
            summary = summary.split(" | ");

            for(var i=0; i < omittedLeads.length; i++) {
                if(summary[0].search(omittedLeads[i]) >= 0) {
                    summary.shift();
                }
            }

            $uibModalInstance.possibleFilename = summary[0].split("/").pop();

            return [summary, $uibModalInstance.possibleFilename];
        };

        $scope.toggleFilerSummaryVisibility = function() {
            $scope.isFilerSummaryVisible = !$scope.isFilerSummaryVisible;
        };

        $scope.isFilerSummaryVisible = false;

        /*
         *  Attempt to find a good product/component for this failure
         */
        $scope.findProduct = function() {
            $scope.suggestedProducts = [];
            var failurePath = $uibModalInstance.parsedSummary[0][0];
            var failurePathRoot = failurePath.split("/")[0];

            // Look up the product via the root of the failure's file path
            if(thBugzillaProductObject[failurePathRoot]) {
                $scope.suggestedProducts.push(thBugzillaProductObject[failurePathRoot][0]);
            }

            // Look up product suggestions via Bugzilla's api
            var productSearch = $scope.productSearch;

            if(productSearch) {
                $http.get("https://bugzilla.mozilla.org/rest/prod_comp_search/" + productSearch + "?limit=5").then(function(request) {
                    var data = request.data;
                    $scope.suggestedProducts = [];
                    for(var i = 0; i < data.products.length;i++) {
                        if(data.products[i].product && data.products[i].component) {
                            $scope.suggestedProducts.push(data.products[i].product + " :: " + data.products[i].component);
                        }
                    }
                });
            }
        };

        /*
         *  This is called once intermittent.html's ng-repeat is finished to select the first product listed
         */
        $scope.focusProduct = function() {
            $("#suggestedProducts").children(":first").children(":first").prop("checked", true);
        };

        /*
         *  Same as clicking outside of the modal, but with a nice button-clicking feel...
         */
        $scope.cancelFiler = function() {
            $uibModalInstance.dismiss('cancel');
        };

        /*
         *  Actually send the gathered information to bugzilla.
         */
        $scope.submitFiler = function() {
            var bugzillaRoot = "https://bugzilla-dev.allizom.org/"; // (prod is "https://bugzilla.mozilla.org/");
            var summarystring = $scope.modalSummary;
            var productString = "";
            var componentString = "";
            var isProductSelected = false;

            $(':input','#modalForm').attr("disabled",true);

            var productRadios = $("#modalForm input[name='productGroup'");
            if(productRadios && productRadios.length) {
                for(var i=0, len=productRadios.length; i<len; i++) {
                    if(productRadios[i].checked) {
                        productString += productRadios[i].value.split(" :: ")[0];
                        componentString += productRadios[i].value.split(" :: ")[1];
                        isProductSelected = true;
                        break;
                    }
                }
            } else {
                if(productRadios && productRadios.checked) {
                    productString += productRadios.value.split(" :: ")[0];
                    componentString += productRadios.value.split(" :: ")[1];
                    isProductSelected = true;
                }
            }

            if(!isProductSelected) {
                alert("Please select (or search and select) a product/component pair to continue");
                return;
            }
            var logstrings = "";
            var logcheckboxes = document.getElementById("modalLogLinkCheckboxes").getElementsByTagName("input");

            for(var i=0;i<logcheckboxes.length;i++) {
                if(logcheckboxes[i].checked) {
                    logstrings += logcheckboxes[i].nextElementSibling.href + "\n\n";
                }
            }

            // Fetch product information from bugzilla to get version numbers, then submit the new bug
            // Only request the versions because some products take quite a long time to fetch the full object
            $.ajax(bugzillaRoot + "rest/product/" + productString + "?include_fields=versions").done(function(productJSON) {
                var productObject = productJSON.products[0];
                $http({
                    //url: bugzillaRoot + "rest/bug?api_key=qF8lX6AyGjcZcmSV4tZTmy2F2PbBycQdB9lsp8cB",
                    url: "api/bugzilla/create_bug/",
                    method: "POST",
                    data: {
                        "product": productString,
                        "component": componentString,
                        "summary": summarystring,
                        "keywords": "intermittent-failure",
                        // XXX This takes the last version returned from the product query, probably should be smarter about this in the future...
                        "version": productObject.versions[productObject.versions.length-1].name,
                        "description": logstrings + document.getElementById("modalComment").value,
                        "comment_tags": "treeherder",
                        // XXX Still should implement ccstring, dependson, blocks, and needinfo fields
                    }
                }).then(function successCallback(json) {
                    if(json.data.failure) {
                        var errorString = "";
                        for (var i = 0; i < json.data.failure.length; i++) {
                            errorString += json.data.failure[i];
                        }
                        errorString = JSON.parse(errorString);
                        thNotify.send("Bugzilla error: " + errorString.message, "danger", true);
                        $(':input','#modalForm').attr("disabled",false);
                    } else {
                        // Auto-classify this failure now that the bug has been filed and we have a bug number
                        thPinboard.pinJob($rootScope.selectedJob);
                        thPinboard.addBug({id:json.data.success});
                        // This isn't working; user has to still click the 'save' button...
                        $rootScope.$evalAsync($rootScope.$emit(thEvents.saveClassification));

                        // Open the newly filed bug in a new tab or window for further editing
                        window.open(bugzillaRoot + "show_bug.cgi?id=" + json.data.success);
                        $scope.cancelFiler();
                    }
                }, function errorCallback(response) {
                    $log.debug(response);
                });
            });
        };
    }
]);

