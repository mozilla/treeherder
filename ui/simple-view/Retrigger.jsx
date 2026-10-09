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

import { RETRIGGER, RETRIGGER_RESET_MS } from './constants';

// Taskcluster only signs in from origins it has a client for. Anywhere else
// the button says where it works instead of failing quietly.
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
  try {
    return RepositoryModel.getRepo(name, await repos);
  } catch (error) {
    repos = null;
    throw error;
  }
};

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
    let currentRepo;
    try {
      currentRepo = await getRepo(repo);
    } catch {
      settle('failed', RETRIGGER_RESET_MS.failed);
      return;
    }
    // JobModel.retrigger reports through notify rather than a return value.
    JobModel.retrigger(jobs, currentRepo, (message, severity) => {
      if (String(message).includes(tcCredentialsMessage)) settle('signin');
      else if (severity === 'danger') settle('failed', RETRIGGER_RESET_MS.failed);
      else if (String(message).startsWith('Request sent')) settle('sent', RETRIGGER_RESET_MS.sent);
    });
  };

  // Phones block window.open once a tap has awaited anything, so ask for
  // Taskcluster approval inside the tap itself.
  const sendOrSignIn = () => {
    if (hasTaskclusterCredentials()) {
      send();
    } else {
      taskcluster.getAuthCode();
      settle('signin');
    }
  };

  const onClick = () => {
    if (!live) settle(state === 'elsewhere' ? 'idle' : 'elsewhere', RETRIGGER_RESET_MS.elsewhere);
    else if (state === 'idle') settle('confirm', RETRIGGER_RESET_MS.confirm);
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
      {RETRIGGER[state](n)}
    </button>
  );
};

export default Retrigger;
