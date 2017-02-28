const mount = require('enzyme').mount;
const shallow = require('enzyme').shallow;
const revisions = require('../../../../ui/js/react/treeherder/revision-list.jsx');
const RevisionList = revisions.RevisionList;
const RevisionItem = revisions.RevisionItem;
const MoreRevisionsLink = revisions.MoreRevisionsLink;

describe('Revision list component', () => {
    let $injector, mockData;
    beforeEach(angular.mock.module('treeherder'));
    beforeEach(inject((_$injector_) => {
        $injector = _$injector_;

        const repo = {
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
        // Mock these simple functions so we don't have to call ThRepositoryModel.load() first to use them
        repo.getRevisionHref = () => `${repo.url}/rev/${resultset.revision}`;
        repo.getPushLogHref = (revision) => `${repo.pushlogURL}?changeset=${revision}`;

        const resultset = {
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
                "author": "André Bargull <andre.bargull@gmail.com>",
                "comments": "Bug 1319926 - Part 2: Collect telemetry about deprecated String generics methods. r=jandem"
            }, {
                "result_set_id": 151371,
                "repository_id": 2,
                "revision": "07d6bf74b7a2552da91b5e2fce0fa0bc3b457394",
                "author": "André Bargull <andre.bargull@gmail.com>",
                "comments": "Bug 1319926 - Part 1: Warn when deprecated String generics methods are used. r=jandem"
            }, {
                "result_set_id": 151371,
                "repository_id": 2,
                "revision": "e83eaf2380c65400dc03c6f3615d4b2cef669af3",
                "author": "Frédéric Wang <fred.wang@free.fr>",
                "comments": "Bug 1322743 - Add STIX Two Math to the list of math fonts. r=karlt"
            }]
        };
        mockData = {
            resultset,
            repo
        };
    }));

    it('renders the correct number of revisions in a list', () => {
        const wrapper = mount(<RevisionList repo={mockData.repo} resultset={mockData.resultset}
                                            $injector={$injector}/>);
        expect(wrapper.find(RevisionItem).length).toEqual(mockData['resultset']['revision_count']);
    });

    it('renders an "...and more" link if the revision count is higher than the max display count of 20', () => {
        mockData.resultset.revision_count = 21;

        const wrapper = mount(<RevisionList repo={mockData.repo} resultset={mockData.resultset}
                                            $injector={$injector}/>);
        expect(wrapper.find(MoreRevisionsLink).length).toEqual(1);
    });

});

describe('Revision item component', () => {
    let $injector, linkifyBugsFilter, initialsFilter, mockData;
    beforeEach(angular.mock.module('treeherder'));
    beforeEach(inject((_$injector_, $filter) => {
        $injector = _$injector_;
        initialsFilter = $filter('initials');
        linkifyBugsFilter = $filter('linkifyBugs');

        const repo = {
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
        const revision = {
            "result_set_id": 151371,
            "repository_id": 2,
            "revision": "5a110ad242ead60e71d2186bae78b1fb766ad5ff",
            "author": "André Bargull <andre.bargull@gmail.com>",
            "comments": "Bug 1319926 - Part 2: Collect telemetry about deprecated String generics methods. r=jandem"
        };
        // Mock these simple functions so we don't have to call ThRepositoryModel.load() first to use them
        repo.getRevisionHref = () => `${repo.url}/rev/${revision.revision}`;
        repo.getPushLogHref = (revision) => `${repo.pushlogURL}?changeset=${revision}`;

        mockData = {
            revision,
            repo
        }
    }));

    it('renders a linked revision hash', () => {
        const wrapper = mount(<RevisionItem repo={mockData.repo} revision={mockData.revision}
                                            initialsFilter={initialsFilter} linkifyBugsFilter={linkifyBugsFilter}/>);
        const link = wrapper.find('a');
        expect(link.length).toEqual(1);
        expect(link.node.href).toEqual(mockData.repo.getRevisionHref());
        expect(link.node.title).toEqual(`Open revision ${mockData.revision.revision} on ${mockData.repo.url}`);
    });

    it(`renders the contributors' initials`, () => {
        const wrapper = mount(<RevisionItem repo={mockData.repo} revision={mockData.revision}
                                            initialsFilter={initialsFilter} linkifyBugsFilter={linkifyBugsFilter}/>);
        const initials = wrapper.find('span[title="André Bargull: andre.bargull@gmail.com"]');
        expect(initials.length).toEqual(1);
        expect(initials.text()).toEqual('AB');
    });

    it('linkifies bug IDs in the comments', () => {
        const wrapper = mount(<RevisionItem repo={mockData.repo} revision={mockData.revision}
                                            initialsFilter={initialsFilter} linkifyBugsFilter={linkifyBugsFilter}/>);
        const escapedComment = _.escape(mockData.revision.comments.split('\n')[0]);
        const linkifiedCommentText = linkifyBugsFilter(escapedComment);

        const comment = wrapper.find('.revision-comment em');
        expect(comment.node.innerHTML).toEqual(linkifiedCommentText);
    });

    it('marks the revision as backed out if the words "Back/Backed out" appear in the comments', () => {
        mockData.revision.comments = "Backed out changeset a6e2d96c1274 (bug 1322565) for eslint failure";
        let wrapper = mount(<RevisionItem repo={mockData.repo} revision={mockData.revision}
                                            initialsFilter={initialsFilter} linkifyBugsFilter={linkifyBugsFilter}/>);
        expect(wrapper.find({'data-tags': 'backout'}).length).toEqual(1);

        mockData.revision.comments = "Back out changeset a6e2d96c1274 (bug 1322565) for eslint failure";
        wrapper = mount(<RevisionItem repo={mockData.repo} revision={mockData.revision}
                                          initialsFilter={initialsFilter} linkifyBugsFilter={linkifyBugsFilter}/>);
        expect(wrapper.find({'data-tags': 'backout'}).length).toEqual(1);
    });
});

describe('More revisions link component', () => {
    it('renders an "...and more" link', () => {
        const wrapper = mount(<MoreRevisionsLink href='http://more.link/'/>);
        const link = wrapper.find('a');
        expect(link.node.href).toEqual('http://more.link/');
        expect(link.text()).toEqual('\u2026and more');
    });

    it('has an external link icon', () => {
        const wrapper = mount(<MoreRevisionsLink href='http://more.link'/>);
        expect(wrapper.find('i.fa.fa-external-link-square').length).toEqual(1);
    })
});
