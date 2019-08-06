import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  waitForElement,
} from '@testing-library/react';

import SelectorCard from '../../../ui/perfherder/compare/SelectorCard';
import { selectorCardText } from '../../../ui/perfherder/constants';

const valid_hash = 'validhash21fb1fd66aea14a2f5ecfc06e68f75c';

const mockGetRevisions = async () => ({
  data: { results: [{ id: 524930, revision: valid_hash }] },
  failureStatus: null,
});

const parentSetState = (data, parentState) => {
  if (data.newRevision) {
    parentState.selectedRevision = data.newRevision;
  }
};

afterEach(cleanup);

const renderReactNode = (getRevisions, updateState, parentState) => (
  <SelectorCard
    revisionState="newRevision"
    selectedRevision={parentState.selectedRevision}
    selectedRepo="testProject"
    updateState={data => {
      parentSetState(data, parentState);
    }}
    projectState="projectState"
    title="Test"
    getRevisions={getRevisions}
    projects={[{ name: 'testProject' }]}
  />
);

const selectorCard = (getRevisions, updateState, parentState, ref) =>
  render(renderReactNode(getRevisions, updateState, parentState, ref));

test('correct hash for input value is valid', async () => {
  const parentState = { selectedRevision: valid_hash };

  const renderResult = selectorCard(
    mockGetRevisions,
    parentSetState,
    parentState,
  );

  const { getByPlaceholderText, queryByText } = renderResult;

  const inputRevision = await waitForElement(() =>
    getByPlaceholderText(selectorCardText.revisionPlaceHolder),
  );
  expect(inputRevision).toBeInTheDocument();
  expect(inputRevision.value).toBe(valid_hash);
  expect(queryByText(selectorCardText.invalidRevisionLength)).toBeNull();
});

test('hash with whitespaces for input value is valid', async () => {
  const hash_with_whitespaces = `  ${valid_hash}  `;
  const parentState = { selectedRevision: hash_with_whitespaces };

  const renderResult = selectorCard(
    mockGetRevisions,
    parentSetState,
    parentState,
  );

  const { getByPlaceholderText, queryByText } = renderResult;

  const inputRevision = await waitForElement(() =>
    getByPlaceholderText(selectorCardText.revisionPlaceHolder),
  );

  expect(inputRevision).toBeInTheDocument();
  expect(inputRevision.value).toBe(hash_with_whitespaces);
  expect(queryByText(selectorCardText.invalidRevisionLength)).toBeNull();
});

test('incorrect hash for input value is invalid', async () => {
  const parentState = { selectedRevision: '' };

  const renderResult = selectorCard(
    mockGetRevisions,
    parentSetState,
    parentState,
  );

  const { getByPlaceholderText, queryByText } = renderResult;
  const inputRevision = await waitForElement(() =>
    getByPlaceholderText(selectorCardText.revisionPlaceHolder),
  );
  expect(inputRevision).toBeInTheDocument();
  expect(inputRevision.value).toBe('');

  const incorrect_hash = 'incorrect_hash';
  fireEvent.change(inputRevision, { target: { value: incorrect_hash } });

  renderResult.rerender(
    renderReactNode(mockGetRevisions, parentSetState, parentState),
  );

  expect(inputRevision.value).toBe(incorrect_hash);
  const validationMessage = queryByText(selectorCardText.invalidRevisionLength);
  expect(validationMessage).toBeInTheDocument();
});
