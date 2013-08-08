treeherder.provider('thServiceDomain', function() {
    this.$get = function() {
        if (window.thServiceDomain) {
            return window.thServiceDomain;
        } else {
            return "http://dev.treeherder.mozilla.org";
        }
    };
});
