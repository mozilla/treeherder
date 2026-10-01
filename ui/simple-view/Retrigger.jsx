import { useEffect, useRef, useState } from 'react';

import JobModel from '../models/job';
import RepositoryModel from '../models/repository';
import dayjs from '../helpers/dayjs';
import taskcluster, { tcCredentialsMessage } from '../helpers/taskcluster';
import {
  checkRootUrl,
  prodFirefoxRootUrl,
  tcClientIdMap,
} from '../taskcluster-auth-callback/constants';

import { RETRIGGER } from './strings';

// Taskcluster only signs in from origins it has a client for. Anywhere else
// the button can't send, so it says where it can instead of failing quietly.
export const canRetrigger = () => !!tcClientIdMap[window.location.origin];

// The same check taskcluster.getCredentials makes, done synchronously.
export const hasTaskclusterCredentials = (
  rootUrl = checkRootUrl(prodFirefoxRootUrl),
) => {
  try {
    const stored = JSON.parse(localStorage.getItem('userCredentials'));
    return !!stored?.[rootUrl] && dayjs(stored[rootUrl].expires).isAfter(dayjs());
  } catch {
    return false;
  }
};

let repos;
const getRepo = async (name) => {
  repos = repos || RepositoryModel.getList();
  return RepositoryModel.getRepo(name, await repos);
};

const LABELS = RETRIGGER;

// One button for the question a red push leaves you with: is it me, or is
// it flaky? Rerunning the failed jobs answers it.
const Retrigger = ({ jobs, repo, live = canRetrigger() }) => {
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

  // Phones only open a new tab from inside a tap. Treeherder's retrigger asks
  // for Taskcluster approval after several requests, by which point the tap
  // is long over and the tab gets blocked. So check for credentials here,
  // synchronously, and if there are none open the approval tab now and wait
  // for the next tap; with credentials, the retrigger never needs a tab.
  const sendOrSignIn = () => {
    if (hasTaskclusterCredentials()) {
      send();
    } else {
      taskcluster.getAuthCode();
      settle('signin');
    }
  };

  const onClick = () => {
    if (!live) settle(state === 'elsewhere' ? 'idle' : 'elsewhere', 6000);
    else if (state === 'idle') settle('confirm', 4000);
    else if (['confirm', 'signin', 'failed'].includes(state)) sendOrSignIn();
  };

  return (
    <button
      type="button"
      className={`sv-action sv-action-${state}`}
      onClick={onClick}
      disabled={state === 'sending' || state === 'sent'}
      aria-live="polite"
    >
      {LABELS[state](n)}
    </button>
  );
};

export default Retrigger;
