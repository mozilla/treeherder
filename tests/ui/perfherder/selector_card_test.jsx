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

const renderReactNode = (getRevisions, updateState, parentState, ref) => (
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
    ref={ref}
  />
);

const selectorCard = (getRevisions, updateState, parentState, ref) =>
  render(renderReactNode(getRevisions, updateState, parentState, ref));

test('correct hash for input value is valid', async () => {
  const parentState = { selectedRevision: valid_hash };

  const ref = React.createRef();

  const renderResult = selectorCard(
    mockGetRevisions,
    parentSetState,
    parentState,
    ref,
  );

  const { getByPlaceholderText } = renderResult;

  const inputRevision = await waitForElement(() =>
    getByPlaceholderText(selectorCardText.revisionPlaceHolder),
  );

  expect(inputRevision).toBeInTheDocument();
  expect(inputRevision.value).toBe(valid_hash);
  expect(ref.current.state.invalidRevision).toBeFalsy();
  expect(ref.current.state.validated).toBeTruthy();
});

test('hash with whitespaces for input value is valid', async () => {
  const hash_with_whitespaces = `  ${valid_hash}  `;
  const parentState = { selectedRevision: hash_with_whitespaces };

  const ref = React.createRef();

  const renderResult = selectorCard(
    mockGetRevisions,
    parentSetState,
    parentState,
    ref,
  );

  const { getByPlaceholderText } = renderResult;

  const inputRevision = await waitForElement(() =>
    getByPlaceholderText(selectorCardText.revisionPlaceHolder),
  );

  expect(inputRevision).toBeInTheDocument();
  expect(inputRevision.value).toBe(hash_with_whitespaces);
  expect(ref.current.state.invalidRevision).toBeFalsy();
  expect(ref.current.state.validated).toBeTruthy();
});

test('incorrect hash for input value is invalid', async () => {
  const parentState = { selectedRevision: '' };

  const ref = React.createRef();
  const renderResult = selectorCard(
    mockGetRevisions,
    parentSetState,
    parentState,
    ref,
  );

  const { getByPlaceholderText } = renderResult;

  const inputRevision = await waitForElement(() =>
    getByPlaceholderText(selectorCardText.revisionPlaceHolder),
  );
  expect(inputRevision).toBeInTheDocument();
  expect(inputRevision.value).toBe('');
  expect(ref.current.state.invalidRevision).toBeFalsy();
  expect(ref.current.state.validated).toBeFalsy();

  const incorrect_hash = 'incorrect_hash';
  fireEvent.change(inputRevision, { target: { value: incorrect_hash } });

  renderResult.rerender(
    renderReactNode(mockGetRevisions, parentSetState, parentState, ref),
  );

  expect(inputRevision.value).toBe(incorrect_hash);
  expect(ref.current.state.invalidRevision).toBe(
    selectorCardText.invalidRevisionLength,
  );
  expect(ref.current.state.validated).toBeFalsy();
});
