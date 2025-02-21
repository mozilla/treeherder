import React from 'react';
import { render } from '@testing-library/react';

import DropdownMenuItems from '../../../ui/shared/DropdownMenuItems';

const selectedItem = 'fenix';
const options = [
  'mozilla-central',
  'autoland',
  'fenix',
  'socorro',
  'taskgraph',
  'servo-master',
  'ash',
];
const pinned = ['fenix', 'autoland', 'tunafish', 'socorro'];
const updateData = () => {};

const repoDropdownMenuItems = () =>
  render(
    <DropdownMenuItems
      selectedItem={selectedItem}
      options={options.sort().filter((item) => !pinned.includes(item))}
      pinned={pinned.filter((item) => options.includes(item))}
      updateData={updateData}
    />,
  );

test('Pinned options are listed first', async () => {
  const { getAllByRole } = repoDropdownMenuItems();
  const items = getAllByRole('menuitem', { hidden: true });

  expect(items[0].textContent).toContain('fenix');
  expect(items[1].textContent).toContain('autoland');
  expect(items[2].textContent).toContain('socorro');
});

test('Bogus pinned items are not listed', async () => {
  const { getAllByRole } = repoDropdownMenuItems();
  const items = getAllByRole('menuitem', { hidden: true });

  expect(items[2].textContent).not.toContain('tunafish');
});

test('Unpinned items are sorted alphabetically', async () => {
  const { getAllByRole } = repoDropdownMenuItems();
  const items = getAllByRole('menuitem', { hidden: true });

  expect(items[3].textContent).toContain('ash');
  expect(items[4].textContent).toContain('mozilla-central');
  expect(items[5].textContent).toContain('servo-master');
  expect(items[6].textContent).toContain('taskgraph');
});

test('Pinned options are listed only once', async () => {
  const { getAllByRole } = repoDropdownMenuItems();
  const items = getAllByRole('menuitem', { hidden: true });

  expect(items[4].textContent).not.toContain('autoland');
  expect(items[5].textContent).not.toContain('fenix');
});
