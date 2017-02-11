'use strict';
/* global ReactDOM, revisionListComponent, revisionItemComponent */
var TestUtils = React.addons.TestUtils;

describe('Revision', () => {
    var $filter, $injector, mockData, component, rendered;
    beforeEach(angular.mock.module('treeherder'));
    beforeEach(angular.mock.module('react'));
    beforeEach(inject((_$filter_, _$injector_) => {
        $filter = _$filter_;
        $injector = _$injector_;
    }));
    beforeEach(() => {
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
    });

    describe('list component', () => {
        beforeEach(() => {
            component = TestUtils.renderIntoDocument(revisionListComponent({
                resultset: mockData.resultset,
                repo: mockData.repo,
                $injector
            }));
            rendered = ReactDOM.findDOMNode(component);
        });

        it('renders the correct number of revisions in a list', () => {
            var listEl = rendered.querySelector('ul');
            expect(listEl.children.length).toEqual(mockData['resultset']['revision_count']);
        });
    });

    describe('list component with greater than the maximum display count of 20 revisions', () => {
        beforeEach(() => {
            mockData.resultset.revision_count = 21;
            component = TestUtils.renderIntoDocument(revisionListComponent({
                resultset: mockData.resultset,
                repo: mockData.repo,
                $injector
            }));
            rendered = ReactDOM.findDOMNode(component);
        });

        it('renders an "...and more" link', () => {
            var revisionItems = rendered.querySelectorAll('li');
            expect(revisionItems.length).toEqual(mockData.resultset.revisions.length + 1);

            var lastItem = revisionItems[revisionItems.length - 1];
            expect(lastItem.textContent).toEqual('\u2026and more');
            expect(lastItem.querySelector('a i.fa.fa-external-link-square')).toBeDefined();
        });
    });

    describe('item component', () => {
        beforeEach(() => {
            component = TestUtils.renderIntoDocument(revisionItemComponent({
                revision: mockData.resultset.revisions[0],
                repo: mockData.repo,
                $injector
            }));
            rendered = ReactDOM.findDOMNode(component);
        });

        it('renders a linked revision hash', () => {
            var link = rendered.querySelector('.revision-holder a');
            expect(link.href).toEqual(mockData.repo.getRevisionHref());
            expect(link.title).toEqual(`Open revision ${mockData.resultset.revisions[0].revision} on ${mockData.repo.url}`);
        });

        it('renders the contributor\'s initials', () => {
            var initials = rendered.querySelector('.label.label-initials');
            expect(initials.textContent).toEqual('AB');
            expect(initials.parentNode.title).toEqual('André Bargull: andre.bargull@gmail.com');
        });

        it('linkifies bugs IDs in the comment', () => {
            var escapedComment = _.escape(mockData.resultset.revisions[0].comments.split('\n')[0]);
            var linkifiedCommentText = $filter('linkifyBugs')(escapedComment);
            var commentEm = rendered.querySelector('.revision-comment em');
            expect(commentEm.innerHTML).toEqual(linkifiedCommentText);
        });
    });

    describe('item component with "back out" in comments', () => {
        beforeEach(() => {
            mockData.resultset.revisions[0].comments = "Back out changeset a6e2d96c1274 (bug 1322565) for eslint failure";
            component = TestUtils.renderIntoDocument(revisionItemComponent({
                revision: mockData.resultset.revisions[0],
                repo: mockData.repo,
                $injector
            }));
            rendered = ReactDOM.findDOMNode(component);
        });

        it('marks the revision as backed out', () => {
            var revisionEl = rendered.querySelector('.revision');
            expect(revisionEl.dataset.tags.indexOf('backout')).not.toEqual(-1);
        });
    });

    describe('item component with "backed out" in comments', () => {
        beforeEach(() => {
            mockData.resultset.revisions[0].comments = "Backed out changeset a6e2d96c1274 (bug 1322565) for eslint failure";
            component = TestUtils.renderIntoDocument(revisionItemComponent({
                revision: mockData.resultset.revisions[0],
                repo: mockData.repo,
                $injector
            }));
            rendered = ReactDOM.findDOMNode(component);
        });

        it('marks the revision as backed out', () => {
            var revisionEl = rendered.querySelector('.revision');
            expect(revisionEl.dataset.tags.indexOf('backout')).not.toEqual(-1);
        });
    });

});
