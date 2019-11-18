import { tcAuthCallbackUrl } from '../helpers/url';

export const tcClientIdMap = {
  'https://treeherder.mozilla.org': 'production',
  'https://treeherder.allizom.org': 'stage',
  'https://treeherder-prototype.herokuapp.com': 'dev',
  'http://localhost:5000': 'localhost',
};

export const clientId = `treeherder-${tcClientIdMap[window.location.origin]}`;

export const redirectURI = `${window.location.origin}${tcAuthCallbackUrl}`;

export const errorMessage = `There was a problem verifying your Taskcluster credentials. Please try again later.`;
