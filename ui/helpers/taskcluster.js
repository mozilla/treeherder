import { Queue } from 'taskcluster-client-web';
import debounce from 'lodash/debounce';
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
    // we're storing these for use in the TaskclusterCallback component (taskcluster-auth)
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

  // this is for situations where multiple retriggers are initiatied in rapid succession
  // (it will call getAuthCode the first time and ignore subsequent calls within the specified time range
  const getDebouncedAuthCode = debounce(getAuthCode, 1000, {
    leading: true,
    trailing: false,
  });

  const getCredentials = (rootUrl) =>
    new Promise((resolve, reject) => {
      const userCredentials = JSON.parse(
        localStorage.getItem('userCredentials'),
      );
      _rootUrl = checkRootUrl(rootUrl);

      if (
        userCredentials &&
        userCredentials[_rootUrl] &&
        moment(userCredentials[_rootUrl].expires).isAfter(moment())
      ) {
        // eslint-disable-next-line no-promise-executor-return
        return resolve(userCredentials[_rootUrl]);
      }

      getDebouncedAuthCode();
      setTimeout(() => {
        const userCredentials = JSON.parse(
          localStorage.getItem('userCredentials'),
        );

        return userCredentials && userCredentials[_rootUrl]
          ? resolve(userCredentials[_rootUrl])
          : reject(new Error(tcCredentialsMessage));
      }, 4000);
    });

  const getMockCredentials = () =>
    Promise.resolve({
      credentials: {
        clientId: 'test client',
        accessToken: '123fgt',
      },
    });

  const getQueue = async (rootUrl, testMode = false) => {
    const userCredentials = await (testMode
      ? getMockCredentials()
      : getCredentials(rootUrl));

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
  const action = actionArray.find((result) => result.name === actionName);

  if (!action) {
    throw Error(
      `'${actionName}' action is not available for this task.  Available: ${actionArray
        .map((act) => act.name)
        .join(', ')}`,
    );
  }

  return action;
};

export default taskcluster;
