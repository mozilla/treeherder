import React from 'react';
import { render, cleanup, waitFor } from '@testing-library/react';

import ComparePageTitle from '../../../../ui/shared/ComparePageTitle';

const title =
  'macosx1014-64-shippable: raptor-tp6-binast-instagram-firefox opt';
const defaultPageTitle =
  'macosx1014-64-shippable: raptor-tp6-binast-instagram-firefox opt';

const comparePageTitle = (hasSubtests) => {
  return (
    <ComparePageTitle
      title={
        hasSubtests
          ? `${title} subtest summary`
          : 'Perfherder Compare Revisions'
      }
      pageTitleQueryParam={null}
      defaultPageTitle={defaultPageTitle}
    />
  );
};

afterEach(cleanup);

test('Compare page title includes the platform name with subtest summary when there are subtests', async () => {
  const { getByText } = render(comparePageTitle(true));

  const pageTitle = await waitFor(() => getByText(`${title} subtest summary`));

  expect(pageTitle).toBeInTheDocument();
});

test('Compare page tab title includes platform name', async () => {
  render(comparePageTitle(true));

  await waitFor(() => expect(document.title).toBe(defaultPageTitle));
});
