app.controller("tree_url_ctrl", function($scope) {
    $scope.bug_id_url1="https://bugzilla.mozilla.org/show_bug.cgi?id={{::bug.id}}";
    $scope.bug_id_url2="https://bugzilla.mozilla.org/show_bug.cgi?id={{bug.bug_id}}";
    $scope.machine_name_url="https://secure.pub.build.mozilla.org/builddata/reports/slave_health/slave.html?name={{job.machine_name}}";
});
