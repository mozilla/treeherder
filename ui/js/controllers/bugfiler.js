"use strict";

treeherder.controller('BugFilerCtrl', [
    '$scope', '$rootScope', '$modalInstance', '$http', 'summary', 'thPinboard', 'thEvents',
    'fullLog', 'parsedLog', 'reftest', 'selectedJob', 'allFailures', 'thNotify', 'ThLog',
    function BugFilerCtrl(
        $scope, $rootScope, $modalInstance, $http, summary, thPinboard, thEvents,
        fullLog, parsedLog, reftest, selectedJob, allFailures, thNotify, ThLog) {

        var $log = new ThLog("BugFilerCtrl");

        $modalInstance.productObject = {
            "accessible":
                ["Core :: Disability Access APIs","Firefox :: Disability Access"],
            "addon-sdk":
                ["Add-on SDK :: General"],
            "b2g":
                ["Firefox OS :: General"],
            "browser":
                ["Firefox :: General"],
            "build":
                ["Core :: Build Config"],
            "caps":
                ["Core :: Security: CAPS"],
            "chrome":
                ["???"],
            "config":
                ["Firefox :: Build Config","Core :: Build Config","Firefox for Android :: Build Config & IDE Support"],
            "db":
                ["Toolkit :: Storage"],
            "devtools":
                ["Firefox :: Developer Tools"],
            "docshell":
                ["Core :: Document Navigation"],
            "dom":
                ["Core :: DOM","???"],
            "editor":
                ["Core :: Editor"],
            "embedding":
                ["Core :: Embedding: APIs"],
            "extensions":
                ["???"],
            "gfx":
                ["Core :: Graphics","Core :: Graphics: Layers","Core :: Graphics: Text"],
            "gradle":
                ["Core :: Build Config"],
            "hal":
                ["Core :: Hardware Abstraction Layer (HAL)"],
            "image":
                ["Core :: ImageLib"],
            "intl":
                ["Core :: Internationalization"],
            "ipc":
                ["Core :: IPC","Core :: DOM: Content Processes"],
            "js":
                ["Core :: Javascript Engine","Core :: Javascript Engine: Jit","Core :: Javascript Engine: GC","Core :: Javascript Engine: Internationalization API","Core :: Javascript Engine: Standard Library"],
            "layout":
                ["Core :: Layout","???"],
            "media":
                ["Core :: Audio/Video","???"],
            "memory":
                ["Core :: Memory Allocator"],
            "mfbt":
                ["Core :: MFBT"],
            "mobile":
                ["Firefox for Android :: General","???"],
            "modules":
                ["???"],
            "mozglue":
                ["Core :: mozglue"],
            "netwerk":
                ["Core :: Networking"],
            "nsprpub":
                ["NSPR :: NSPR"],
            "other-licenses":
                ["???"],
            "parser":
                ["Core :: HTML: Parser"],
            "probes":
                ["???"],
            "python":
                ["???"],
            "rdf":
                ["Core :: RDF"],
            "security":
                ["Core :: Security","Firefox :: Security"],
            "services":
                ["Core :: Web Services"],
            "startupcache":
                ["Core :: XPCOM"],
            "storage":
                ["Toolkit :: Storage"],
            "testing":
                ["Testing :: General"],
            "toolkit":
                ["Toolkit :: General","???"],
            "tools":
                ["???"],
            "uriloader":
                ["???"],
            "view":
                ["Core :: Layout"],
            "webapprt":
                ["Firefox :: Webapp Runtime"],
            "widget":
                ["Core :: Widget"],
            "xpcom":
                ["Core :: XPCOM"],
            "xpfe":
                ["Core :: XUL"],
            "xulrunner":
                ["Toolkit :: XULRunner"]
        };

        $modalInstance.defaultproductObject = {
            // XXX
        };

        /**
         *  Pre-fill the form with information/metadata from the failure
         */
        $scope.initiate = function() {
            $modalInstance.parsedSummary = $modalInstance.parseSummary(summary);

            console.log($modalInstance.parsedSummary, fullLog, parsedLog, reftest, selectedJob, allFailures);

            // Allow 'enter' from the product finder input box to trigger the search
            document.getElementById("modalProductFinderSearch").addEventListener("keypress", function(e) {
                if(e.keyCode === 13) {
                    $scope.findProduct();
                }
            });

            document.getElementById("modalSummary").value = "Intermittent " + $modalInstance.parsedSummary[0].join(" | ");

            document.getElementById("modalParsedLog").nextElementSibling.href = parsedLog;
            document.getElementById("modalFullLog").nextElementSibling.href = fullLog;
            document.getElementById("modalReftestLog").nextElementSibling.href = reftest;

            for(var i=0;i<allFailures.length;i++) {
                console.log(allFailures[i]);
                var omittedLeads = ["TEST-UNEXPECTED-FAIL", "PROCESS-CRASH", "TEST-UNEXPECTED-ERROR", "TEST-UNEXPECTED-TIMEOUT"];
                for(var j=0; j < omittedLeads.length; j++) {
                    if(allFailures[i][0].search(omittedLeads[j]) >= 0) {
                        allFailures[i].shift();
                    }
                }
                var thisFailure = document.createElement("div");
                thisFailure.textContent = allFailures[i].join(" | ");
                document.getElementById("modalFailureList").appendChild(thisFailure);
            }

            // Only show the reftest viewer link if this is a reftest
            if(reftest == "") {
                document.getElementById("modalReftestLogLabel").className = "hidden";
                document.getElementById("modalReftestLog").removeAttribute("checked");
            } else {
                document.getElementById("modalReftestLogLabel").className = "";
                document.getElementById("modalReftestLog").setAttribute("checked", true);
            }

            $scope.findProduct();
        };

        $modalInstance.parsedSummary = "";
        $modalInstance.initiate = $scope.initiate;
        $modalInstance.possibleFilename = "";

        /*
         *  Remove extraneous junk from the start of the summary line
         *  and try to find the failing test name from what's left
         */
        $modalInstance.parseSummary = function(summary) {
            var omittedLeads = ["TEST-UNEXPECTED-FAIL", "PROCESS-CRASH", "TEST-UNEXPECTED-ERROR", "TEST-UNEXPECTED-TIMEOUT"];
            summary = summary.split(" | ");

            for(var i=0; i < omittedLeads.length; i++) {
                if(summary[0].search(omittedLeads[i]) >= 0) {
                    summary.shift();
                }
            }
    // XXX Maybe get crash signatures too?
            $modalInstance.possibleFilename = summary[0].split("/").pop();

            return [summary, $modalInstance.possibleFilename];
        };

        /*
         *  Toggle the visibility of the rest of the lines from the failure summary
         */
        $scope.toggleFailures = function(evt) {
            var target = evt.target;
            if(target.tagName.toUpperCase() == "I") {
                target = target.parentNode;
            }
            if(target.className == "btn btn-xs failure-expando-closed") {
                target.className = "btn btn-xs failure-expando-open";
                target.firstElementChild.className = "fa fa-chevron-down";
                $("#failureSummaryGroup")[0].className = "expanded";
            } else {
                target.className = "btn btn-xs failure-expando-closed";
                target.firstElementChild.className = "fa fa-chevron-right";
                $("#failureSummaryGroup")[0].className = "collapsed";
            }
        };

        /*
         *  Attempt to find a good product/component for this failure
         */
        $scope.findProduct = function() {

            var suggestedProducts = [];
            var failurePath = $modalInstance.parsedSummary[0][0];
            var failurePathRoot = failurePath.split("/")[0];

            // Look up the product via the root of the failure's file path
            // XXX THIS NEEDS TO BE MUCH MORE ROBUST
            if($modalInstance.productObject[failurePathRoot]) {
                suggestedProducts.push($modalInstance.productObject[failurePathRoot][0]);
            }

            createProductElements();

            // Look up product suggestions via Bugzilla's api
            var productSearch = document.getElementById("modalProductFinderSearch").value;

            if(productSearch) {
                $.get("https://bugzilla.mozilla.org/rest/prod_comp_search/" + productSearch + "?limit=5", function(data) {
                    console.log(data.products);
                    for(var i = 0; i < data.products.length;i++) {
                        if(data.products[i].product && data.products[i].component) {
                            suggestedProducts.push(data.products[i].product + " :: " + data.products[i].component);
                        }
                    }
                    createProductElements();
                });
            }

            function createProductElements() {
                $("#suggestedProducts").empty();
                for(var i = 0; i < suggestedProducts.length; i++) {
                    $("<input type='radio' name='productGroup'>")
                        .prop("value", suggestedProducts[i]).prop("id", "modalProductSuggestion" + i).appendTo("#suggestedProducts");
                    $("<label></label>").prop("for", "modalProductSuggestion" + i).text(suggestedProducts[i]).appendTo("#suggestedProducts");
                    $("<br/>").appendTo("#suggestedProducts");
                }
                // Make sure we always have a selected product
                $("#suggestedProducts").children(":first").prop("checked", true);
            }
        };

        /*
         *  Same as clicking outside of the modal, but with a nice button-clicking feel...
         */
        $scope.cancelFiler = function() {
            $modalInstance.dismiss('cancel');
        };

        /*
         *  Actually send the gathered information to bugzilla.
         */
        $scope.submitFiler = function() {
            var bugzillaRoot = "https://bugzilla-dev.allizom.org/"; // (prod is "https://bugzilla.mozilla.org/");
            var summarystring = document.getElementById("modalSummary").value;

            var productString = "";
            var componentString = "";
            var isProductSelected = false;

            $(':input','#modalForm').attr("disabled",true);

            var productRadios = document.getElementById("modalForm").elements["productGroup"];
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
                console.log(productObject.versions);
                $http({
                    //url: bugzillaRoot + "rest/bug?api_key=qF8lX6AyGjcZcmSV4tZTmy2F2PbBycQdB9lsp8cB",
                    url: "api/bugzilla/create_bug/",
                    method: "POST",
                    data: {
                        "product": productString,
                        "component": componentString,
                        "summary": summarystring,
                        "keywords": "intermittent-failure",//var keywordsstring = "&keywords=" + encodeURIComponent(document.getElementById("modalKeywords").value);
                      //  "dependson": [""],//var dependsstring = "&dependson=" + encodeURIComponent(document.getElementById("modalDepends").value);
                      //  "blocks": [""],//var blocksstring = "&blocked=" + encodeURIComponent(document.getElementById("modalBlocks").value);
                        // XXX This takes the last version returned from the product query, probably should be smarter about this in the future...
                        "version": productObject.versions[productObject.versions.length-1].name,
                        "description": logstrings + document.getElementById("modalComment").value,
                        "comment_tags": "treeherder",
                      //XXX var ccstring = "&cc=" + encodeURIComponent(document.getElementById("modalCc").value);
                      //XXX NEEDINFO FLAG
                    }
                }).then(function successCallback(json) {
                    if(json.data.failure) {
                        var errorString = "";
                        for (var i = 0; i < json.data.failure.length; i++) {
                            errorString += json.data.failure[i];
                        }
                        errorString = JSON.parse(errorString);
                        console.log("FAILURE", errorString);
                        thNotify.send("Bugzilla error: " + errorString.message, "danger", true);
                        $(':input','#modalForm').attr("disabled",false);
                    } else {
                        console.log(json.data);

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
                    console.log("HI",response);
                    $log.debug("sup");
                });
            });
        };
    }
]);

