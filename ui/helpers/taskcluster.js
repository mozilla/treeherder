import { Queue } from 'taskcluster-client-web';
import debounce from 'lodash/debounce';
import moment from 'moment';

import { clientId, redirectURI } from '../taskcluster-auth-callback/constants';

import { loginRootUrl, createQueryParams } from './url';

export const tcCredentialsMessage =
  'Need to retrieve or renew Taskcluster credentials before action can be performed.';

const taskcluster = (() => {
  let _rootUrl = null;

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

  const getAuthCode = debounce(
    () => {
      const nonce = generateNonce();
      localStorage.setItem('requestState', nonce);
      localStorage.setItem('tcRootUrl', _rootUrl);

      const params = {
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectURI,
        scope: 'treeherder',
        state: nonce,
      };

      window.open(
        `${_rootUrl}login/oauth/authorize${createQueryParams(params)}`,
        '_blank',
      );
    },
    300,
    {
      leading: true,
      trailing: false,
    },
  );

  const getCredentials = rootUrl => {
    const userCredentials = JSON.parse(localStorage.getItem('userCredentials'));
    // TODO remove staging instance
    _rootUrl =
      rootUrl === loginRootUrl
        ? 'https://hassan.taskcluster-dev.net/'
        : rootUrl;

    if (
      !userCredentials ||
      !userCredentials[_rootUrl] ||
      !moment(userCredentials[_rootUrl].expires).isAfter(moment())
    ) {
      getAuthCode();
      return null;
    }
    return userCredentials[_rootUrl];
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
