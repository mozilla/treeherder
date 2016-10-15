'use strict';

describe('Revision list react component', () => {
    var $filter;
    var compile, mockData;
    beforeEach(module('treeherder'));
    beforeEach(module('react'));
    beforeEach(inject((_$filter_) => {
        $filter = _$filter_;
    }));
    beforeEach(inject(() => {
        var resultset = {
            "id": 151371,
            "revision_hash": "0056da58e1efd70711c8f98336eaf866f1aa8936",
            "revision": "5a110ad242ead60e71d2186bae78b1fb766ad5ff",
            "revisions_uri": "/api/project/mozilla-inbound/resultset/151371/revisions/",
            "revision_count": 3,
            "author": "ryanvm@gmail.com",
            "push_timestamp": 1481326280,
            "repository_id": 2,
            "revisions": [{
                "result_set_id": 151371,
                "repository_id": 2,
                "revision": "5a110ad242ead60e71d2186bae78b1fb766ad5ff",
                "author":"André Bargull <andre.bargull@gmail.com>",
                "comments": "Bug 1319926 - Part 2: Collect telemetry about deprecated String generics methods. r=jandem"
            },{
                "result_set_id": 151371,
                "repository_id": 2,
                "revision": "07d6bf74b7a2552da91b5e2fce0fa0bc3b457394",
                "author": "André Bargull <andre.bargull@gmail.com>",
                "comments":"Bug 1319926 - Part 1: Warn when deprecated String generics methods are used. r=jandem"
            },{
                "result_set_id": 151371,
                "repository_id": 2,
                "revision": "e83eaf2380c65400dc03c6f3615d4b2cef669af3",
                "author": "Frédéric Wang <fred.wang@free.fr>",
                "comments": "Bug 1322743 - Add STIX Two Math to the list of math fonts. r=karlt"
            }]
        };
        var repo = {
            "id": 2,
            "repository_group": {
                "name": "development",
                "description": ""
            },
            "name": "mozilla-inbound",
            "dvcs_type": "hg",
            "url": "https://hg.mozilla.org/integration/mozilla-inbound",
            "branch": null,
            "codebase": "gecko",
            "description": "",
            "active_status": "active",
            "performance_alerts_enabled": true,
            "pushlogURL": "https://hg.mozilla.org/integration/mozilla-inbound/pushloghtml"
        };
         // Mock these simple functions so we don't have to call ThRepositoryModel.load() first to use it
        repo.getRevisionHref = () => `${repo.url}/rev/${resultset.revision}`;
        repo.getPushLogHref = (revision) => `${repo.pushlogURL}?changeset=${revision}`;
        mockData = {
            resultset,
            repo
        };
    }));

    beforeEach(inject(($rootScope, $timeout, $compile) => {
        compile = function(el, scope) {
            var $scope = $rootScope.$new();
            $scope = _.extend($scope, scope);
            var compiledEl = $compile(el)($scope);
            $timeout.flush();
            $scope.$digest();
            return compiledEl;
        };
    }));

    it('renders the correct number of revisions in a list', () => {
        var component = compile('<revisions repo="repo" resultset="resultset" />', mockData);
        var revisionItems = component[0].querySelectorAll('li');
        expect(revisionItems.length).toEqual(mockData['resultset']['revision_count']);
    });

    it('renders the linked revision hashes', () => {
        var component = compile('<revisions repo="repo" resultset="resultset" />', mockData);
        var links = component[0].querySelectorAll('.revision-holder a');
        expect(links.length).toEqual(mockData['resultset']['revision_count']);
        Array.prototype.forEach.call(links, (link, i) => {
            expect(link.href).toEqual(mockData.repo.getRevisionHref());
            expect(link.title).toEqual(`Open revision ${mockData.resultset.revisions[i].revision} on ${mockData.repo.url}`);
        });
    });

    it('renders the contributors\' initials', () => {
        var component = compile('<revisions repo="repo" resultset="resultset" />', mockData);
        var initials = component[0].querySelectorAll('.label.label-initials');
        expect(initials.length).toEqual(mockData.resultset.revision_count);
        Array.prototype.forEach.call(initials, (initial, i) => {
            var revisionData = mockData.resultset.revisions[i];
            var userTokens = revisionData.author.split(/[<>]+/);
            var name = userTokens[0];
            var email = null;
            if (userTokens.length > 1) email = userTokens[1];
            var nameString = name;
            if (email !== null) nameString += `: ${email}`;

            expect(initial.outerHTML).toEqual($filter('initials')(name));
            expect(initial.parentNode.title).toEqual(nameString);
        });
    });

    it('renders an "and more" link if the revision count is higher than the number of revisions in the resultset', () => {
        mockData.resultset.revision_count = 10;

        var component = compile('<revisions repo="repo" resultset="resultset" />', mockData);
        var revisionItems = component[0].querySelectorAll('li');
        expect(revisionItems.length).toEqual(mockData.resultset.revisions.length + 1);

        var lastItem = revisionItems[revisionItems.length - 1];
        expect(lastItem.textContent).toEqual('\u2026and more');
        expect(lastItem.querySelector('a i.fa.fa-external-link-square')).toBeDefined();
    });

    it('linkifies bugs IDs in the comments', () => {
        var escapedComment = _.escape(mockData.resultset.revisions[0].comments.split('\n')[0]);
        var linkifiedCommentText = $filter('linkifyBugs')(escapedComment);

        var component = compile('<revisions repo="repo" resultset="resultset" />', mockData);
        var commentEm = component[0].querySelector('.revision-comment em');
        expect(commentEm.innerHTML).toEqual(linkifiedCommentText);

    });

    it('marks the revision as backed out if the words "Back/Backed out" appear in the comments', () => {
        var component, firstRevision;
        mockData.resultset.revisions[0].comments = "Backed out changeset a6e2d96c1274 (bug 1322565) for eslint failure";

        component = compile('<revisions repo="repo" resultset="resultset" />', mockData);
        firstRevision = component[0].querySelector('li .revision');
        expect(firstRevision.getAttribute('data-tags').indexOf('backout')).not.toEqual(-1);

        mockData.resultset.revisions[0].comments = "Back out changeset a6e2d96c1274 (bug 1322565) for eslint failure";
        component = compile('<revisions repo="repo" resultset="resultset" />', mockData);
        firstRevision = component[0].querySelector('li .revision');
        expect(firstRevision.getAttribute('data-tags').indexOf('backout')).not.toEqual(-1);
    });

});
