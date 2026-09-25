import { useEffect, useRef, useState } from 'react';

import JobModel from '../models/job';
import RepositoryModel from '../models/repository';
import { tcCredentialsMessage } from '../helpers/taskcluster';
import { tcClientIdMap } from '../taskcluster-auth-callback/constants';

// Taskcluster only signs in from origins it has a client for. Anywhere else
// the button could only fail, so it isn't shown.
export const canRetrigger = () => !!tcClientIdMap[window.location.origin];

let repos;
const getRepo = async (name) => {
  repos = repos || RepositoryModel.getList();
  return RepositoryModel.getRepo(name, await repos);
};

const LABELS = {
  idle: (n) => `Run ${n === 1 ? 'the failure' : `the ${n} failures`} again`,
  confirm: (n) => `Tap again to rerun ${n} ${n === 1 ? 'job' : 'jobs'}`,
  sending: () => 'Sending…',
  sent: () => "Sent. They'll show up here as they run.",
  signin: () => 'Approve Taskcluster in the new tab, then tap again.',
  failed: () => "Couldn't send that. Tap to try again.",
};

// One button for the question a red push leaves you with: is it me, or is
// it flaky? Rerunning the failed jobs answers it.
const Retrigger = ({ jobs, repo }) => {
  const [state, setState] = useState('idle');
  const timer = useRef();
  const n = jobs.length;

  useEffect(() => () => clearTimeout(timer.current), []);

  const settle = (next, ms) => {
    clearTimeout(timer.current);
    setState(next);
    if (ms) timer.current = setTimeout(() => setState('idle'), ms);
  };

  const send = async () => {
    settle('sending');
    const currentRepo = await getRepo(repo);
    // JobModel.retrigger reports through notify rather than a return value.
    JobModel.retrigger(jobs, currentRepo, (message, severity) => {
      if (String(message).includes(tcCredentialsMessage)) settle('signin');
      else if (severity === 'danger') settle('failed', 6000);
      else if (String(message).startsWith('Request sent')) settle('sent', 8000);
    });
  };

  const onClick = () => {
    if (state === 'confirm') send();
    else if (['idle', 'signin', 'failed'].includes(state)) {
      if (state === 'idle') settle('confirm', 4000);
      else send();
    }
  };

  return (
    <button
      type="button"
      className={`pv-action pv-action-${state}`}
      onClick={onClick}
      disabled={state === 'sending' || state === 'sent'}
      aria-live="polite"
    >
      {LABELS[state](n)}
    </button>
  );
};

export default Retrigger;
