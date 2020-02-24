import { Queue } from 'taskcluster-client-web';
import debounce from 'lodash/debounce';
import delay from 'lodash/delay';
import moment from 'moment';

import {
  clientId,
  redirectURI,
  checkRootUrl,
  prodFirefoxRootUrl,
} from '../taskcluster-auth-callback/constants';

import { createQueryParams } from './url';

export const tcCredentialsMessage =
  'Need to retrieve or renew Taskcluster credentials before action can be performed.';

const taskcluster = (() => {
  let _rootUrl = checkRootUrl(prodFirefoxRootUrl);

  // from the MDN crypto.getRandomValues doc
  const secureRandom = () =>
    window.crypto.getRandomValues(new Uint32Array(1))[0] / 4294967295;

  const generateNonce = () => {
    let value = '';
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i <= 20; i++) {
      value += characters.charAt(
        Math.floor(secureRandom() * characters.length),
      );
    }

    localStorage.setItem('requestState', value);
    return value;
  };

  const getAuthCode = (useExistingWindow = false) => {
    const nonce = generateNonce();
    // we're storing these for use in the TaskclusterCallback component (taskcluster-auth.html)
    // since that's the only way for it to get access to them
    localStorage.setItem('requestState', nonce);
    localStorage.setItem('tcRootUrl', _rootUrl);

    // the expires param is optional and if it's greater than the maxExpires value that's been
    // registered with the client (set to 3 days) or is omitted, expiry will default to maxExpires
    const params = {
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectURI,
      scope: 'hooks:trigger-hook:*',
      state: nonce,
    };
    const url = `${_rootUrl}/login/oauth/authorize${createQueryParams(params)}`;

    if (useExistingWindow) {
      window.location.href = url;
    } else {
      window.open(url, '_blank');
    }
  };

  const getDebouncedAuthCode = debounce(getAuthCode, 500, {
    leading: true,
    trailing: false,
  });

  const getCredentials = rootUrl => {
    const userCredentials = JSON.parse(localStorage.getItem('userCredentials'));
    _rootUrl = checkRootUrl(rootUrl);

    if (
      userCredentials &&
      userCredentials[_rootUrl] &&
      moment(userCredentials[_rootUrl].expires).isAfter(moment())
    ) {
      return userCredentials[_rootUrl];
    }

    getDebouncedAuthCode();
    return delay(() => {
      const userCredentials = JSON.parse(
        localStorage.getItem('userCredentials'),
      );
      return userCredentials && userCredentials[_rootUrl]
        ? userCredentials[_rootUrl]
        : null;
    }, 2000);
  };

  const getMockCredentials = () => ({
    clientId: 'test client',
    accessToken: '123fgt',
  });

  const getQueue = (rootUrl, testMode = false) => {
    const userCredentials = testMode
      ? getMockCredentials()
      : getCredentials(rootUrl);
    if (!userCredentials) {
      throw Error(tcCredentialsMessage);
    }

    return new Queue({
      rootUrl,
      credentials: userCredentials.credentials,
    });
  };

  return {
    getCredentials,
    getQueue,
    getMockCredentials,
    getAuthCode,
  };
})();

export const getAction = (actionArray, actionName) => {
  const action = actionArray.find(result => result.name === actionName);

  if (!action) {
    throw Error(
      `'${actionName}' action is not available for this task.  Available: ${actionArray
        .map(act => act.name)
        .join(', ')}`,
    );
  }

  return action;
};

export default taskcluster;
