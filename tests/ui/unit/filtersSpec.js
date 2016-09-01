'use strict';

describe('linkifyURLs filter', function() {
    var $filter;
    beforeEach(module('treeherder'));
    beforeEach(inject(function(_$filter_) {
        $filter = _$filter_;
    }));

    it('linkifies a URL', function() {
        var linkifyURLs = $filter('linkifyURLs');
        expect(linkifyURLs('https://www.mozilla.org'))
          .toEqual('<a href="https://www.mozilla.org" target="_blank">https://www.mozilla.org</a>');
    });

    it('does not linkify a non-URL', function() {
        var linkifyURLs = $filter('linkifyURLs');
        expect(linkifyURLs('h tee tee pee ess')).toEqual('h tee tee pee ess');
    });

    it('linkifies a mix of URL and non-URL', function() {
        var linkifyURLs = $filter('linkifyURLs');
        expect(linkifyURLs('This is a test: https://www.mozilla.org Did I pass?'))
          .toEqual('This is a test: <a href="https://www.mozilla.org" target="_blank">https://www.mozilla.org</a> Did I pass?');
    });
});

describe('linkifyBugs filter', function() {
    var $filter;
    beforeEach(module('treeherder'));
    beforeEach(inject(function(_$filter_) {
        $filter = _$filter_;
    }));

    it('linkifies a Bug', function() {
        var linkifyBugs = $filter('linkifyBugs');
        expect(linkifyBugs('Bug 123456'))
          .toEqual('Bug <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=123456" data-bugid=123456 title=bugzilla.mozilla.org>123456</a>');
    });

    it('linkifies a PR', function() {
        var linkifyBugs = $filter('linkifyBugs');
        expect(linkifyBugs('PR#123456'))
          .toEqual('PR#<a href="https://github.com/mozilla-b2g/gaia/pull/123456" data-prid=123456 title=github.com>123456</a>');
    });
});

describe('initials filter', function() {
    var $filter;
    beforeEach(module('treeherder'));
    beforeEach(inject(function(_$filter_) {
        $filter = _$filter_;
    }));

    it('initializes a one-word name', function() {
        var initials = $filter('initials');
        expect(initials('Starscream')).toEqual('<span class="label label-initials">S</span>');
    });

    it('initializes a two-word name', function() {
        var initials = $filter('initials');
        expect(initials('Optimus Prime')).toEqual('<span class="label label-initials">OP</span>');
    });

    it('initializes a three-word name', function() {
        var initials = $filter('initials');
        expect(initials('Some Other Transformer')).toEqual('<span class="label label-initials">ST</span>');
    });
});

describe('highlightCommonTerms filter', function() {
    var $filter;
    beforeEach(module('treeherder'));
    beforeEach(inject(function(_$filter_) {
        $filter = _$filter_;
    }));

    it('highlights common terms', function() {
        var highlightCommonTerms = $filter('highlightCommonTerms');
        expect(highlightCommonTerms('This is a long string of words', 'I hate long words'))
          .toEqual('This is a <strong>long</strong> string of <strong>words</strong>');
    });

    it('highlights common terms with apostrophe', function() {
        var highlightCommonTerms = $filter('highlightCommonTerms');
        expect(highlightCommonTerms("Somewhere in this sentence 'is' an apostrophe.", "What is your name?"))
          .toEqual("Somewhere in this sentence '<strong>is</strong>' an apostrophe.");
    });

    it('highlights common terms with apostrophe in both strings', function() {
        var highlightCommonTerms = $filter('highlightCommonTerms');
        expect(highlightCommonTerms("Somewhere in this sentence 'is' an apostrophe.", "What 'is' your name?"))
          .toEqual("Somewhere in this sentence '<strong>is</strong>' an apostrophe.");
    });

    it('highlights common terms with quotes', function() {
        var highlightCommonTerms = $filter('highlightCommonTerms');
        expect(highlightCommonTerms('Somewhere in this sentence "is" a quotation mark.', "What is your name?"))
          .toEqual('Somewhere in this sentence "<strong>is</strong>" a quotation mark.');
    });

    it('highlights common terms with quotes in both strings', function() {
        var highlightCommonTerms = $filter('highlightCommonTerms');
        expect(highlightCommonTerms('Somewhere in this sentence "is" a quotation mark.', 'What "is" your name?'))
          .toEqual('Somewhere in this sentence "<strong>is</strong>" a quotation mark.');
    });

    it('highlights common terms with brackets', function() {
        var highlightCommonTerms = $filter('highlightCommonTerms');
        expect(highlightCommonTerms('How about [some] brackets', 'Would you like some highlighted words?'))
          .toEqual('How about [<strong>some</strong>] brackets');
    });

    it('highlights common terms with parentheses', function() {
        var highlightCommonTerms = $filter('highlightCommonTerms');
        expect(highlightCommonTerms('How about (some) parentheses', 'Would you like some highlighted words?'))
          .toEqual('How about (<strong>some</strong>) parentheses');
    });

    it('highlights common terms with slashes', function() {
        var highlightCommonTerms = $filter('highlightCommonTerms');
        expect(highlightCommonTerms('This /string/has/a lot\\of\\slashes', 'Short string of words'))
          .toEqual('This /<strong>string</strong>/has/a lot\\<strong>of</strong>\\slashes');
    });

    it('highlights common terms with colons', function() {
        var highlightCommonTerms = $filter('highlightCommonTerms');
        expect(highlightCommonTerms('What if I assign property:value somewhere?', 'I value your opinion'))
          .toEqual('What if <strong>I</strong> assign property:<strong>value</strong> somewhere?');
    });
});

describe('escapeHTML filter', function() {
    var $filter;
    beforeEach(module('treeherder'));
    beforeEach(inject(function(_$filter_) {
        $filter = _$filter_;
    }));

    it('escapes some html symbols', function() {
        var escapeHTML = $filter('escapeHTML');
        expect(escapeHTML('<This \'is the \"worst>')).toEqual('&lt;This &#39;is the &quot;worst&gt;');
    });
});

describe('getRevisionUrl filter', function() {
    var $filter;
    beforeEach(module('treeherder'));
    beforeEach(inject(function(_$filter_) {
        $filter = _$filter_;
    }));

    it('escapes some html symbols', function() {
        var getRevisionUrl = $filter('getRevisionUrl');
        expect(getRevisionUrl('1234567890ab', 'mozilla-inbound'))
          .toEqual('/#/jobs?repo=mozilla-inbound&revision=1234567890ab');
    });
});

describe('showOrHide filter', function() {
    var $filter;
    beforeEach(module('treeherder'));
    beforeEach(inject(function(_$filter_) {
        $filter = _$filter_;
    }));

    it('says show', function() {
        var showOrHide = $filter('showOrHide');
        expect(showOrHide(' me', true)).toEqual('show me');
    });

    it('says hide', function() {
        var showOrHide = $filter('showOrHide');
        expect(showOrHide(' me', false)).toEqual('hide me');
    });
});

describe('stripHtml filter', function() {
    var $filter;
    beforeEach(module('treeherder'));
    beforeEach(inject(function(_$filter_) {
        $filter = _$filter_;
    }));

    it('deletes html tags', function() {
        var stripHtml = $filter('stripHtml');
        expect(stripHtml('My <html is> deleted')).toEqual('My  deleted');
    });
});

describe('linkifyClassifications filter', function() {
    var $filter;
    var $rootScope;
    beforeEach(module('treeherder'));
    beforeEach(inject(function(_$filter_) {
        $filter = _$filter_;
    }));
    beforeEach(inject(function($rootScope) {
        $rootScope.repos = [{
          'id': 1,
          'repository_group': {
            'description': '',
            'name': 'development'
          },
          'name': 'mozilla-central',
          'dvcs_type': 'hg',
          'url': 'https://hg.mozilla.org/mozilla/central',
        }];
    }));

    it('linkifies classifications', function() {
        var linkifyClassifications = $filter('linkifyClassifications');
        expect(linkifyClassifications('1234567890ab', 'mozilla-central'))
          .toEqual('<a href="https://hg.mozilla.org/mozilla/central/rev/1234567890ab">1234567890ab</a>');
    });
});

describe('encodeURIComponent filter', function() {
    var $filter;
    beforeEach(module('treeherder'));
    beforeEach(inject(function(_$filter_) {
        $filter = _$filter_;
    }));

    it('encodes uri components', function() {
        var encodeURIComponent = $filter('encodeURIComponent');
        expect(encodeURIComponent('this/is.a?URI#Component')).toEqual('this%2Fis.a%3FURI%23Component');
    });
});

describe('displayPrecision filter', function() {
    var $filter;
    beforeEach(module('treeherder'));
    beforeEach(inject(function(_$filter_) {
        $filter = _$filter_;
    }));

    it('does some extra things', function() {
        var displayPrecision = $filter('displayPrecision');
        expect(displayPrecision('123.53222')).toEqual('123.53');
        expect(displayPrecision(1/0)).toEqual('Infinity');
    });
});
