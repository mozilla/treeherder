import React from 'react';
import { mount } from 'enzyme';

import RepositoryModel from '../../../../ui/models/repository';
import { Revision, Initials } from '../../../../ui/job-view/Revision';
import {
  RevisionList,
  MoreRevisionsLink,
} from '../../../../ui/job-view/RevisionList';

describe('Revision list component', () => {
  let mockData;

  beforeEach(() => {

    const repo = new RepositoryModel({
      id: 2,
      repository_group: {
        name: 'development',
        description: '',
      },
      name: 'mozilla-inbound',
      dvcs_type: 'hg',
      url: 'https://hg.mozilla.org/integration/mozilla-inbound',
      branch: null,
      codebase: 'gecko',
      description: '',
      active_status: 'active',
      performance_alerts_enabled: true,
      pushlogURL: 'https://hg.mozilla.org/integration/mozilla-inbound/pushloghtml',
    });

        const push = {
            id: 151371,
            revision: '5a110ad242ead60e71d2186bae78b1fb766ad5ff',
            revision_count: 3,
            author: 'ryanvm@gmail.com',
            push_timestamp: 1481326280,
            repository_id: 2,
            revisions: [{
                result_set_id: 151371,
                repository_id: 2,
                revision: '5a110ad242ead60e71d2186bae78b1fb766ad5ff',
                author: 'André Bargull <andre.bargull@gmail.com>',
                comments: 'Bug 1319926 - Part 2: Collect telemetry about deprecated String generics methods. r=jandem',
            }, {
                result_set_id: 151371,
                repository_id: 2,
                revision: '07d6bf74b7a2552da91b5e2fce0fa0bc3b457394',
                author: 'André Bargull <andre.bargull@gmail.com>',
                comments: 'Bug 1319926 - Part 1: Warn when deprecated String generics methods are used. r=jandem',
            }, {
                result_set_id: 151371,
                repository_id: 2,
                revision: 'e83eaf2380c65400dc03c6f3615d4b2cef669af3',
                author: 'Frédéric Wang <fred.wang@free.fr>',
                comments: 'Bug 1322743 - Add STIX Two Math to the list of math fonts. r=karlt',
            }],
        };
        mockData = {
            push,
            repo,
        };
  });

  it('renders the correct number of revisions in a list', () => {
    const wrapper = mount(
      <RevisionList
        repo={mockData.repo}
        push={mockData.push}
      />,
    );
    expect(wrapper.find(Revision).length).toEqual(mockData.push.revision_count);
  });

  it('renders an "...and more" link if the revision count is higher than the max display count of 20', () => {
    mockData.push.revision_count = 21;

    const wrapper = mount(
      <RevisionList
        repo={mockData.repo}
        push={mockData.push}
      />,
    );
    expect(wrapper.find(MoreRevisionsLink).length).toEqual(1);
  });

});

describe('Revision item component', () => {
  let mockData;

  beforeEach(() => {
    const repo = new RepositoryModel({
      id: 2,
      repository_group: {
        name: 'development',
        description: '',
      },
      name: 'mozilla-inbound',
      dvcs_type: 'hg',
      url: 'https://hg.mozilla.org/integration/mozilla-inbound',
      branch: null,
      codebase: 'gecko',
      description: '',
      active_status: 'active',
      performance_alerts_enabled: true,
      pushlogURL: 'https://hg.mozilla.org/integration/mozilla-inbound/pushloghtml',
    });
    const revision = {
      result_set_id: 151371,
      repository_id: 2,
      revision: '5a110ad242ead60e71d2186bae78b1fb766ad5ff',
      author: 'André Bargull <andre.bargull@gmail.com>',
      comments: 'Bug 1319926 - Part 2: Collect telemetry about deprecated String generics methods. r=jandem',
    };

    mockData = {
      revision,
      repo,
    };
  });

  it('renders a linked revision', () => {
    const wrapper = mount(
      <Revision
        repo={mockData.repo}
        revision={mockData.revision}
      />);
    const link = wrapper.find('a').first();
    expect(link.props().href).toEqual(mockData.repo.getRevisionHref(mockData.revision.revision));
    expect(link.props().title).toEqual(`Open revision ${mockData.revision.revision} on ${mockData.repo.url}`);
  });

  it('renders the contributors\' initials', () => {
    const wrapper = mount(
      <Revision
        repo={mockData.repo}
        revision={mockData.revision}
      />);
    const initials = wrapper.find('.user-push-initials');
    expect(initials.length).toEqual(1);
    expect(initials.text()).toEqual('AB');
  });

  it('linkifies bug IDs in the comments', () => {
    const wrapper = mount(
      <Revision
        repo={mockData.repo}
        revision={mockData.revision}
      />);

    const comment = wrapper.find('.revision-comment em');
    expect(comment.html()).toEqual('<em data-job-clear-on-click="true"><span class="Linkify"><a href="https://bugzilla.mozilla.org/show_bug.cgi?id=1319926" target="_blank" rel="noopener noreferrer">Bug 1319926</a> - Part 2: Collect telemetry about deprecated String generics methods. r=jandem</span></em>');
  });

  it('marks the revision as backed out if the words "Back/Backed out" appear in the comments', () => {
    mockData.revision.comments = 'Backed out changeset a6e2d96c1274 (bug 1322565) for eslint failure';
    let wrapper = mount(
      <Revision
        repo={mockData.repo}
        revision={mockData.revision}
      />);
    expect(wrapper.find({ 'data-tags': 'backout' }).length).toEqual(1);

    mockData.revision.comments = 'Back out changeset a6e2d96c1274 (bug 1322565) for eslint failure';
    wrapper = mount(
      <Revision
        repo={mockData.repo}
        revision={mockData.revision}
      />);
    expect(wrapper.find({ 'data-tags': 'backout' }).length).toEqual(1);
  });
});

describe('More revisions link component', () => {
  it('renders an "...and more" link', () => {
    const wrapper = mount(<MoreRevisionsLink href="http://more.link/" />);
    const link = wrapper.find('a');
    expect(link.props().href).toEqual('http://more.link/');
    expect(link.text()).toEqual('\u2026and more');
  });

  it('has an external link icon', () => {
    const wrapper = mount(<MoreRevisionsLink href="http://more.link" />);
    expect(wrapper.find('i.fa.fa-external-link-square').length).toEqual(1);
  });
});

describe('initials filter', function () {
  const email = 'foo@bar.baz';
  it('initializes a one-word name', function () {
    const name = 'Starscream';
    const initials = mount(
      <Initials
        title={`${name}: ${email}`}
        author={name}
      />);
    expect(initials.html()).toEqual('<span title="Starscream: foo@bar.baz"><span class="user-push-icon"><i class="fa fa-user-o" aria-hidden="true" data-job-clear-on-click="true"></i></span><div class="icon-superscript user-push-initials" data-job-clear-on-click="true">S</div></span>');
  });

  it('initializes a two-word name', function () {
    const name = 'Optimus Prime';
    const initials = mount(
      <Initials
        title={`${name}: ${email}`}
        author={name}
      />);
    const userPushInitials = initials.find('.user-push-initials');
    expect(userPushInitials.html()).toEqual('<div class="icon-superscript user-push-initials" data-job-clear-on-click="true">OP</div>');
  });

  it('initializes a three-word name', function () {
    const name = 'Some Other Transformer';
    const initials = mount(
      <Initials
        title={`${name}: ${email}`}
        author={name}
      />);
    const userPushInitials = initials.find('.user-push-initials');
    expect(userPushInitials.html()).toEqual('<div class="icon-superscript user-push-initials" data-job-clear-on-click="true">ST</div>');
  });
});

