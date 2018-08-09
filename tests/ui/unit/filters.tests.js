describe('getRevisionUrl filter', () => {
    let $filter;
    beforeEach(angular.mock.module('treeherder'));
    beforeEach(inject((_$filter_) => {
        $filter = _$filter_;
    }));

    it('escapes some html symbols', () => {
        const getRevisionUrl = $filter('getRevisionUrl');
        expect(getRevisionUrl('1234567890ab', 'mozilla-inbound'))
          .toEqual('/#/jobs?repo=mozilla-inbound&revision=1234567890ab');
    });
});

describe('displayNumber filter', () => {
    let $filter;
    beforeEach(angular.mock.module('treeherder'));
    beforeEach(inject((_$filter_) => {
        $filter = _$filter_;
    }));

    it('returns expected values', () => {
        const displayPrecision = $filter('displayNumber');
        const infinitySymbol = '\u221e';
        expect(displayPrecision('123.53222')).toEqual('123.53');
        expect(displayPrecision('123123123.53222')).toEqual('123,123,123.53');
        expect(displayPrecision(1 / 0)).toEqual(infinitySymbol);
        expect(displayPrecision(Number.NaN)).toEqual('N/A');
    });
});
