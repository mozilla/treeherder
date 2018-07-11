describe('linkifyBugs filter', function() {
    var $filter;
    beforeEach(angular.mock.module('treeherder'));
    beforeEach(inject(function(_$filter_) {
        $filter = _$filter_;
    }));

    it('linkifies a Bug', function() {
        var linkifyBugs = $filter('linkifyBugs');
        expect(linkifyBugs('Bug 123456'))
          .toEqual('Bug <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=123456" data-bugid="123456" title="bugzilla.mozilla.org">123456</a>');
    });
});

describe('getRevisionUrl filter', function() {
    var $filter;
    beforeEach(angular.mock.module('treeherder'));
    beforeEach(inject(function(_$filter_) {
        $filter = _$filter_;
    }));

    it('escapes some html symbols', function() {
        var getRevisionUrl = $filter('getRevisionUrl');
        expect(getRevisionUrl('1234567890ab', 'mozilla-inbound'))
          .toEqual('/#/jobs?repo=mozilla-inbound&revision=1234567890ab');
    });
});

describe('displayNumber filter', function() {
    var $filter;
    beforeEach(angular.mock.module('treeherder'));
    beforeEach(inject(function(_$filter_) {
        $filter = _$filter_;
    }));

    it('returns expected values', function() {
        var displayPrecision = $filter('displayNumber');
        const infinitySymbol = '\u221e';
        expect(displayPrecision('123.53222')).toEqual('123.53');
        expect(displayPrecision('123123123.53222')).toEqual('123,123,123.53');
        expect(displayPrecision(1/0)).toEqual(infinitySymbol);
        expect(displayPrecision(Number.NaN)).toEqual('N/A');
    });
});
