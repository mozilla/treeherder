import React from 'react';
import { render, waitForElement } from '@testing-library/react';

import RepositoryModel from '../../../ui/models/repository';
import { Revision, AuthorInitials } from '../../../ui/shared/Revision';
import {
  RevisionList,
  MoreRevisionsLink,
} from '../../../ui/shared/RevisionList';

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
  revisions: [
    {
      result_set_id: 151371,
      repository_id: 2,
      revision: '5a110ad242ead60e71d2186bae78b1fb766ad5ff',
      author: 'André Bargull <andre.bargull@gmail.com>',
      comments:
        'Bug 1319926 - Part 2: Collect telemetry about deprecated String generics methods. r=jandem',
    },
    {
      result_set_id: 151371,
      repository_id: 2,
      revision: '07d6bf74b7a2552da91b5e2fce0fa0bc3b457394',
      author: 'André Bargull <andre.bargull@gmail.com>',
      comments:
        'Bug 1319926 - Part 1: Warn when deprecated String generics methods are used. r=jandem',
    },
    {
      result_set_id: 151371,
      repository_id: 2,
      revision: 'e83eaf2380c65400dc03c6f3615d4b2cef669af3',
      author: 'Frédéric Wang <fred.wang@free.fr>',
      comments:
        'Bug 1322743 - Add STIX Two Math to the list of math fonts. r=karlt',
    },
  ],
};
const revision = {
  result_set_id: 151371,
  repository_id: 2,
  revision: '5a110ad242ead60e71d2186bae78b1fb766ad5ff',
  author: 'André Bargull <andre.bargull@gmail.com>',
  comments:
    'Bug 1319926 - Part 2: Collect telemetry about deprecated String generics methods. r=jandem',
};

describe('Revision list component', () => {
  beforeEach(() => {});

  test('renders the correct number of revisions in a list', async () => {
    const { getAllByTestId } = render(
      <RevisionList
        repo={repo}
        revision={push.revision}
        revisions={push.revisions}
        revisionCount={push.revision_count}
      />,
    );

    expect(getAllByTestId('revision')).toHaveLength(push.revision_count);
  });

  test('renders an "...and more" link if the revision count is higher than the max display count of 20', () => {
    push.revision_count = 21;

    const { getByText } = render(
      <RevisionList
        repo={repo}
        revision={push.revision}
        revisions={push.revisions}
        revisionCount={push.revision_count}
      />,
    );
    expect(getByText('\u2026and more')).toBeInTheDocument();
  });
});

describe('Revision item component', () => {
  test('renders a linked revision', async () => {
    const { getByTitle, getByText } = render(
      <Revision repo={repo} revision={revision} />,
    );
    const revLink = await waitForElement(() => getByText('5a110ad242ea'));

    expect(revLink.getAttribute('href')).toEqual(
      repo.getRevisionHref(revision.revision),
    );
    expect(
      getByTitle(`Open revision ${revision.revision} on ${repo.url}`),
    ).toBeInTheDocument();
  });

  test("renders the contributors' initials", () => {
    const { getByText } = render(<Revision repo={repo} revision={revision} />);
    expect(getByText('AB')).toBeInTheDocument();
  });

  test('linkifies bug IDs in the comments', () => {
    const { getByTitle } = render(<Revision repo={repo} revision={revision} />);

    expect(
      getByTitle(
        'Bug 1319926 - Part 2: Collect telemetry about deprecated String generics methods. r=jandem',
      ),
    ).toBeInTheDocument();
  });

  test('marks the revision as backed out if the words "Back out" appear in the comments', () => {
    revision.comments =
      'Back out changeset a6e2d96c1274 (bug 1322565) for eslint failure';
    render(<Revision repo={repo} revision={revision} />);

    expect(document.querySelectorAll('.text-danger')).toHaveLength(1);
  });

  test('marks the revision as backed out if the words "Backed out" appear in the comments', () => {
    revision.comments =
      'Backed out changeset a6e2d96c1274 (bug 1322565) for eslint failure';
    render(<Revision repo={repo} revision={revision} />);

    expect(document.querySelectorAll('.text-danger')).toHaveLength(1);
  });
});

describe('More revisions link component', () => {
  test('renders an "...and more" link', () => {
    const { getByText } = render(
      <MoreRevisionsLink href="http://more.link/" />,
    );
    const link = getByText('\u2026and more');

    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toEqual('http://more.link/');
  });

  test('has an external link icon', () => {
    render(<MoreRevisionsLink href="http://more.link" />);

    expect(
      document.querySelectorAll(
        'svg.svg-inline--fa.fa-external-link-square-alt',
      ),
    ).toHaveLength(1);
  });
});

describe('initials filter', () => {
  const email = 'foo@bar.baz';
  test('initializes a one-word name', () => {
    const name = 'Starscream';
    const { getByText } = render(
      <AuthorInitials title={`${name}: ${email}`} author={name} />,
    );

    expect(getByText('S')).toBeInTheDocument();
  });

  test('initializes a two-word name', () => {
    const name = 'Optimus Prime';
    const { getByText } = render(
      <AuthorInitials title={`${name}: ${email}`} author={name} />,
    );

    expect(getByText('OP')).toBeInTheDocument();
  });

  test('initializes a three-word name', () => {
    const name = 'Some Other Transformer';
    const { getByText } = render(
      <AuthorInitials title={`${name}: ${email}`} author={name} />,
    );

    expect(getByText('ST')).toBeInTheDocument();
  });
});
