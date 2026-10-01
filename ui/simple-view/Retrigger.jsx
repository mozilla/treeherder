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

export const canRetrigger = () => !!tcClientIdMap[window.location.origin];

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
    JobModel.retrigger(jobs, currentRepo, (message, severity) => {
      if (String(message).includes(tcCredentialsMessage)) settle('signin');
      else if (severity === 'danger') settle('failed', 6000);
      else if (String(message).startsWith('Request sent')) settle('sent', 8000);
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
