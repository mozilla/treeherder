import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import SummaryItem from '../../../../../ui/job-view/details/tabs/summaryTab/SummaryItem';

const selectedJob = {
  id: 1,
  platform: 'linux',
  job_group_name: 'Mochitest',
  job_type_name: 'test-linux1804-64/opt-mochitest-1',
  job_type_symbol: 'M-1',
};

const suggestion = {
  search: 'TEST-UNEXPECTED-FAIL | dom/tests/test_fail.html | assertion failed',
  path_end: 'dom/tests/test_fail.html',
  bugs: { open_recent: [], all_others: [] },
};

const newButtonTitle =
  'number of times this error message has been seen until now (including this run)';

const renderItem = props =>
  render(
    <MemoryRouter>
      <ul>
        <SummaryItem
          suggestion={suggestion}
          toggleBugFiler={() => {}}
          toggleInternalIssueFiler={() => {}}
          selectedJob={selectedJob}
          jobDetails={[]}
          currentRepo={{ name: 'autoland' }}
          {...props}
        />
      </ul>
    </MemoryRouter>,
  );

describe('SummaryItem', () => {
  test('does not flag a line as new unless asked to', () => {
    renderItem();

    expect(screen.getByText(/assertion failed/)).toBeInTheDocument();
    expect(screen.getByTitle('File a bug for this failure')).toBeInTheDocument();
    expect(screen.queryByTitle(newButtonTitle)).not.toBeInTheDocument();
  });

  test('flags a line as new when asked to', () => {
    renderItem({ showNewButton: true });

    expect(screen.getByTitle(newButtonTitle)).toHaveTextContent('NEW');
  });
});
