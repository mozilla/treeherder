'use strict';

describe('AutoClassify panel', function() {

    beforeEach(module('treeherder.app'));

    it('thStringOverlap', inject(function(thStringOverlap) {
        expect(thStringOverlap("foo bar", "foo baz")).toEqual(1/2);
        expect(thStringOverlap("a/foo bar", "foo baz")).toEqual(1/2);
        expect(thStringOverlap("", "foo baz")).toEqual(0);
        expect(thStringOverlap("foo bar", "")).toEqual(0);
        expect(thStringOverlap("", "")).toEqual(0);
        expect(thStringOverlap("foo", "foo bar")).toEqual(2/3);
        expect(thStringOverlap("foo|baz", "foo | bar")).toEqual(1/2);
    }));
});
