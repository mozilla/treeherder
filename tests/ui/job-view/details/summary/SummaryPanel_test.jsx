import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import SummaryPanel from '../../../../../ui/job-view/details/summary/SummaryPanel';
import {
  usePushesStore,
  initialState as pushesInitialState,
} from '../../../../../ui/job-view/stores/pushesStore';

const selectedJobFull = {
  id: 1,
  task_id: 'TASK_ID',
  state: 'completed',
  result: 'success',
  resultStatus: 'success',
  push_id: 1,
  searchStr: 'test job',
  submit_timestamp: 0,
  job_type_name: 'build-linux',
  job_group_name: 'Build',
  job_type_symbol: 'B',
  build_platform: 'linux',
};

const renderPanel = (extraProps = {}) =>
  render(
    <MemoryRouter>
      <SummaryPanel
        selectedJobFull={selectedJobFull}
        currentRepo={{ name: 'autoland', tc_root_url: 'https://tc.example' }}
        classificationMap={{}}
        bugs={[]}
        user={{ isLoggedIn: true, email: '' }}
        jobLogUrls={[{ name: 'live_backing.log', parse_status: 'parsed' }]}
        logParseStatus="parsed"
        {...extraProps}
      />
    </MemoryRouter>,
  );

describe('SummaryPanel log parsing status', () => {
  beforeEach(() => {
    usePushesStore.setState({
      ...pushesInitialState,
      decisionTaskMap: { 1: { id: 'DEC_TASK' } },
    });
  });

  it('shows the parse status when the task is not expired', () => {
    renderPanel();

    expect(screen.getByText('Log parsing status:')).toBeInTheDocument();
    expect(screen.getByText('parsed')).toBeInTheDocument();
    expect(
      screen.queryByText('Expired, not available'),
    ).not.toBeInTheDocument();
  });

  it('shows an expired message for the log status when the task is expired', () => {
    renderPanel({ taskExpired: true });

    expect(screen.getByText('Expired, not available')).toBeInTheDocument();
    expect(screen.queryByText('parsed')).not.toBeInTheDocument();
  });
});
