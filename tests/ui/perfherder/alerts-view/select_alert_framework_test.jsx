import { render } from '@testing-library/react';
import { noop } from 'lodash';
import React from 'react';

import AlertsViewControls from '../../../../ui/perfherder/alerts/AlertsViewControls';
import FilterControls from '../../../../ui/shared/FilterControls';

const testUser = ({ isLoggedIn, isStaff }) => ({
  username: 'mozilla-ldap/test_user@mozilla.com',
  isLoggedIn,
  isStaff,
  email: 'test_user@mozilla.com',
});

const testFrameworksDropdown = () => {
  const mockFrameworkNames = ['c', 'b'];
  const topFramework = 'top framework';

  const alertDropdowns = [
    {
      options: mockFrameworkNames,
      selectedItem: 'select framework',
      updateData: () => noop(),
      namespace: 'framework',
      pinned: [topFramework],
      otherPinned: ['select framework', 'bottom framework'],
    },
  ];

  return render(
    <FilterControls
      filteredTextValue={false}
      dropdownOptions={alertDropdowns}
      filterOptions={[]}
      updateFilter={() => noop()}
      updateFilterText={() => noop()}
      updateOnEnter
      dropdownCol
    />,
  );
};

test('should pin the right number of items to top and bottom frameworks w.r.t config', async () => {
  testFrameworksDropdown();
  // top pinned represents all items in the drop down that is at the top of the list
  // bottom pinned represents all items in the drop down that is at the bottom of the list.

  const topPinned = document.querySelectorAll('.top-pinned');
  const bottomPinned = document.querySelectorAll('.bottom-pinned');

  expect(topPinned).toHaveLength(1);
  expect(bottomPinned).toHaveLength(2);
});

test('should sort all frameworks after clicking', async () => {
  const alertsViewControls = new AlertsViewControls({
    isListMode: true,
    alertSummaries: { projects: [], alerts: ['a', 'b', 'c'] },
    user: testUser(true, true),
    isRequired: false,
    frameworkOptions: [
      { name: 'framework-z' },
      { name: 'framework-b' },
      { name: 'framework-c' },
      { name: 'framework-a' },
      { name: 'framework-y' },
    ],
    filters: {
      filterText: 'random',
      hideDownstream: true,
      hideAssignedToOthers: true,
      framework: '',
      status: '',
    },
  });

  const filterElement = alertsViewControls.render();
  const filterElementChildren = filterElement.props.children[1];

  expect(filterElementChildren.props.dropdownOptions[1].options).toEqual([
    'framework-a',
    'framework-b',
    'framework-c',
    'framework-y',
    'framework-z',
  ]);
});
