import React from 'react';
import { render, cleanup, waitFor } from '@testing-library/react';

import ComparePageTitle from '../../../../ui/shared/ComparePageTitle';

const title =
  'macosx1014-64-shippable: raptor-tp6-binast-instagram-firefox opt ';
const defaultPageTitle =
  'macosx1014-64-shippable: raptor-tp6-binast-instagram-firefox opt ';

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

test('Compare page title updates with subtests name if there are subtests', async () => {
  const { getByTestId, rerender } = render(comparePageTitle(false));

  let pageTitle = await waitFor(() => getByTestId('compare-page-title'));

  expect(pageTitle.textContent).toBe('Perfherder Compare Revisions');

  rerender(comparePageTitle(true));

  pageTitle = await waitFor(() => getByTestId('compare-page-title'));

  expect(pageTitle.textContent).toBe(`${title} subtest summary`);
});
