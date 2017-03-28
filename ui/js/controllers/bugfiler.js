"use strict";

treeherder.controller('BugFilerCtrl', [
    '$scope', '$rootScope', '$uibModalInstance', '$http', 'summary', 'thBugzillaProductObject',
    'fullLog', 'parsedLog', 'reftest', 'selectedJob', 'allFailures',
    'successCallback', 'thNotify',
    function BugFilerCtrl(
        $scope, $rootScope, $uibModalInstance, $http, summary, thBugzillaProductObject,
        fullLog, parsedLog, reftest, selectedJob, allFailures,
        successCallback, thNotify) {

        var bzBaseUrl = "https://bugzilla.mozilla.org/";

        $scope.omittedLeads = ["TEST-UNEXPECTED-FAIL", "PROCESS-CRASH", "TEST-UNEXPECTED-ERROR", "REFTEST ERROR"];

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

        $scope.parsedLog = parsedLog;
        $scope.fullLog = fullLog;
        if ($scope.isReftest()) {
            $scope.reftest = reftest;
        }

        /**
         *  Pre-fill the form with information/metadata from the failure
         */
        $scope.initiate = function() {
            var thisFailure = "";

            // Auto-block the stylo-bustage metabug if this is a stylo failure
            if (selectedJob.build_platform.includes("stylo")) {
                $scope.modalBlocks = "stylo-bustage,";
            }

            for (var i = 0; i < allFailures.length; i++) {
                for (var j=0; j < $scope.omittedLeads.length; j++) {
                    if (allFailures[i][0].search($scope.omittedLeads[j]) >= 0 && allFailures[i].length > 1) {
                        allFailures[i].shift();
                    }
                }
                if (i !== 0) {
                    thisFailure += "\n";
                }
                thisFailure += allFailures[i].join(" | ");
            }
            $scope.thisFailure = thisFailure;

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
            // Strip out some extra stuff at the start of some failure paths
            var re = /file:\/\/\/home\/worker\/workspace\/build\/tests\/reftest\/tests\//gi;
            summary = summary.replace(re, "");
            re = /\/home\/worker\/workspace\/build\/src\//gi;
            summary = summary.replace(re, "");
            re = /\/home\/worker\/checkouts\/gecko\//gi;
            summary = summary.replace(re, "");
            re = /file:\/\/\/builds\/slave\/test\/build\/tests\/reftest\/tests\//gi;
            summary = summary.replace(re, "");
            re = /file:\/\/\/c:\/slave\/test\/build\/tests\/reftest\/tests\//gi;
            summary = summary.replace(re, "");
            re = /http:\/\/([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+):([0-9]+)\/tests\//gi;
            summary = summary.replace(re, "");
            re = /jetpack-package\//gi;
            summary = summary.replace(re, "");
            re = /xpcshell-child-process.ini:/gi;
            summary = summary.replace(re, "");

            summary = summary.split(" | ");

            for (var i=0; i < $scope.omittedLeads.length; i++) {
                if (summary[0].search($scope.omittedLeads[i]) >= 0 && summary.length > 1) {
                    summary.shift();
                }
            }

            $uibModalInstance.possibleFilename = summary[0].split("/").pop();

            return [summary, $uibModalInstance.possibleFilename];
        };

        $uibModalInstance.parsedSummary = $uibModalInstance.parseSummary(summary);
        var summaryString = $uibModalInstance.parsedSummary[0].join(" | ");
        if (selectedJob.job_group_name.toLowerCase().includes("reftest")) {
            var re = /layout\/reftests\//gi;
            summaryString = summaryString.replace(re, "");
        }
        $scope.modalSummary = "Intermittent " + summaryString;

        $scope.toggleFilerSummaryVisibility = function() {
            $scope.isFilerSummaryVisible = !$scope.isFilerSummaryVisible;
        };

        $scope.isFilerSummaryVisible = false;

        /*
         *  Attempt to find a good product/component for this failure
         */
        $scope.findProduct = function() {
            $scope.suggestedProducts = [];

            // Look up product suggestions via Bugzilla's api
            var productSearch = $scope.productSearch;

            if (productSearch) {
                $http.get(bzBaseUrl + "rest/prod_comp_search/" + productSearch + "?limit=5").then(function(request) {
                    var data = request.data;
                    // We can't file unless product and component are provided, this api can return just product. Cut those out.
                    for (var i = data.products.length - 1; i >= 0; i--) {
                        if (!data.products[i].component) {
                            data.products.splice(i, 1);
                        }
                    }
                    $scope.suggestedProducts = [];
                    $scope.suggestedProducts = _.map(data.products, function(prod) {
                        if (prod.product && prod.component) {
                            return prod.product + " :: " + prod.component;
                        }
                        return prod.product;
                    });
                    $scope.selection.selectedProduct = $scope.suggestedProducts[0];
                });
            } else {
                var failurePath = $uibModalInstance.parsedSummary[0][0];

                // If the "TEST-UNEXPECTED-foo" isn't one of the omitted ones, use the next piece in the summary
                if (failurePath.includes("TEST-UNEXPECTED-")) {
                    failurePath = $uibModalInstance.parsedSummary[0][1];
                }

                // Try to fix up file paths for some job types.
                if (selectedJob.job_group_name.toLowerCase().includes("spidermonkey")) {
                    failurePath = "js/src/tests/" + failurePath;
                }
                if (selectedJob.job_group_name.toLowerCase().includes("videopuppeteer ")) {
                    failurePath = failurePath.replace("FAIL ", "");
                    failurePath = "dom/media/test/external/external_media_tests/" + failurePath;
                }
                if (selectedJob.job_group_name.toLowerCase().includes("web platform")) {
                    failurePath = "testing/web-platform/tests/" + failurePath;
                }

                // Search mercurial's moz.build metadata to find products/components
                $http.get("https://hg.mozilla.org/mozilla-central/json-mozbuildinfo?p=" + failurePath).then(function(request) {
                    if (request.data.aggregate && request.data.aggregate.recommended_bug_component) {
                        var suggested = request.data.aggregate.recommended_bug_component;
                        $scope.suggestedProducts.push(suggested[0] + " :: " + suggested[1]);
                    }

                    if ($scope.suggestedProducts.length === 0) {
                        var jg = selectedJob.job_group_name.toLowerCase();
                        // Some job types are special, lets explicitly handle them.
                        if (jg.includes("web platform")) {
                            $scope.suggestedProducts.push("Testing :: web-platform-tests");
                        }
                        if (jg.includes("talos")) {
                            $scope.suggestedProducts.push("Testing :: Talos");
                        }
                        if (jg.includes("mochitest") && failurePath.includes("webextensions/")) {
                            $scope.suggestedProducts.push("Toolkit :: WebExtensions: General");
                        }
                        if (jg.includes("mochitest") && failurePath.includes("webrtc/")) {
                            $scope.suggestedProducts.push("Core :: WebRTC");
                        }
                    }

                    if ($scope.suggestedProducts.length === 0) {
                        var failurePathRoot = failurePath.split("/")[0];

                        // Last ditch effort, Look up the product via the root of the failure's file path
                        if (thBugzillaProductObject[failurePathRoot]) {
                            $scope.suggestedProducts.push(thBugzillaProductObject[failurePathRoot][0]);
                        }
                    }

                    $scope.selection.selectedProduct = $scope.suggestedProducts[0];
                });
            }

            $scope.selection.selectedProduct = $scope.suggestedProducts[0];
        };

        /*
         *  Same as clicking outside of the modal, but with a nice button-clicking feel...
         */
        $scope.cancelFiler = function() {
            $uibModalInstance.dismiss('cancel');
        };

        $scope.checkedLogLinks = {
            parsedLog: $scope.parsedLog,
            fullLog: $scope.fullLog,
            reftest: $scope.reftest
        };

        $scope.isIntermittent = true;

        /*
         *  Actually send the gathered information to bugzilla.
         */
        $scope.submitFiler = function() {
            var summarystring = $scope.modalSummary;
            var productString = "";
            var componentString = "";

            $scope.toggleForm(true);

            if ($scope.modalSummary.length > 255) {
                thNotify.send("Please ensure the summary is no more than 255 characters", "danger");
                $scope.toggleForm(false);
                return;
            }

            if ($scope.selection.selectedProduct) {
                var prodParts = $scope.selection.selectedProduct.split(" :: ");
                productString += prodParts[0];
                componentString += prodParts[1];
            } else {
                thNotify.send("Please select (or search and select) a product/component pair to continue", "danger");
                $scope.toggleForm(false);
                return;
            }

            var descriptionStrings = _.reduce($scope.checkedLogLinks, function(result, link) {
                if (link) {
                    result = result + link + "\n\n";
                }
                return result;
            }, "");
            if ($scope.modalComment) {
                descriptionStrings += $scope.modalComment;
            }

            var keywords = $scope.isIntermittent ? "intermittent-failure" : "";

            var blocks = $scope.modalBlocks;
            var dependsOn = $scope.modalDependsOn;
            var seeAlso = $scope.modalSeeAlso;

            // Fetch product information from bugzilla to get version numbers, then submit the new bug
            // Only request the versions because some products take quite a long time to fetch the full object
            $http.get(bzBaseUrl + "rest/product/" + productString + "?include_fields=versions")
                .then(function(response) {
                    var productJSON = response.data;
                    var productObject = productJSON.products[0];

                    // Find the newest version for the product that is_active
                    var version = _.findLast(productObject.versions, function(version) {
                        return version.is_active === true;
                    });

                    return $http({
                        url: "api/bugzilla/create_bug/",
                        method: "POST",
                        data: {
                            "product": productString,
                            "component": componentString,
                            "summary": summarystring,
                            "keywords": keywords,
                            "version": version.name,
                            "blocks": blocks,
                            "depends_on": dependsOn,
                            "see_also": seeAlso,
                            "comment": descriptionStrings,
                            "comment_tags": "treeherder"
                        }
                    });
                })
                .then((response) => {
                    var data = response.data;
                    if (data.failure) {
                        var error = JSON.parse(data.failure.join(""));
                        thNotify.send("Bugzilla error: " + error.message, "danger", true);
                        $scope.toggleForm(false);
                    } else {
                        successCallback(data);
                        $scope.cancelFiler();
                    }
                })
                .catch((response) => {
                    var failureString = "Bug Filer API returned status " + response.status + " (" + response.statusText + ")";
                    if (response.data && response.data.failure) {
                        failureString += "\n\n" + response.data.failure;
                    }
                    if (response.status === 403) {
                        failureString += "\n\nAuthentication failed. Has your Treeherder session expired?";
                    }
                    thNotify.send(failureString, "danger");
                    $scope.toggleForm(false);
                });
        };

        /*
         *  Disable or enable form elements as needed at various points in the submission process
         */
        $scope.toggleForm = function(disabled) {
            $(':input','#modalForm').attr("disabled", disabled);
        };
    }
]);

