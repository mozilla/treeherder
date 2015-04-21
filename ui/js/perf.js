/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var perf = angular.module("perf", ['ui.router', 'ui.bootstrap', 'treeherder']);

perf.factory('getSeriesSummary', [ function() {
  return function(signature, signatureProps, optionCollectionMap) {
    var platform = signatureProps.machine_platform + " " +
      signatureProps.machine_architecture;
    var e10s = (signatureProps.job_group_symbol === "T-e10s");
    var testName = signatureProps.test;
    var subtestSignatures;
    if (testName === undefined) {
      testName = "summary";
      subtestSignatures = signatureProps.subtest_signatures;
    }
    var name = signatureProps.suite + " " + testName;
    var options = [ optionCollectionMap[signatureProps.option_collection_hash] ];
    if (e10s) {
      options.push("e10s");
    }
    name = name + " " + options.join(" ");

    return { name: name, signature: signature, platform: platform,
             options: options, subtestSignatures: subtestSignatures };
  };
}]);
