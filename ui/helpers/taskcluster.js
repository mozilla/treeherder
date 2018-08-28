import { OIDCCredentialAgent, fromNow, Queue } from 'taskcluster-client-web';
import { tcRootUrl, getUserSessionUrl } from './url';

const taskcluster = (() => {
  let credentialAgent = null;

  // Create an OIDC credential agent if it doesn't exist.
  const tcAgent = () => {
    if (credentialAgent) {
      return credentialAgent;
    }

    const userSession = localStorage.getItem('userSession');
    const oidcProvider = 'mozilla-auth0';

    if (userSession) {
      credentialAgent = new OIDCCredentialAgent({
        accessToken: JSON.parse(userSession).accessToken,
        oidcProvider,
        url: getUserSessionUrl(oidcProvider),
        rootUrl: tcRootUrl,
      });
    }

    return credentialAgent;
  };

  return {
    getAgent: tcAgent,
    // When the access token is refreshed, simply update it on the credential agent
    getQueue: () => (
      new Queue({
        credentialAgent: tcAgent(),
        rootUrl: tcRootUrl,
      })
    ),
    updateAgent: () => {
      const userSession = localStorage.getItem('userSession');

      if (userSession) {
        tcAgent().accessToken = JSON.parse(userSession).accessToken;
      } else {
        credentialAgent = null;
      }
    },
    refreshTimestamps: (task) => {
      // Take a taskcluster task and make all of the timestamps
      // new again. This is pretty much lifted verbatim from
      // mozilla_ci_tools which was used by pulse_actions.
      // We need to do this because action tasks are created with
      // timestamps for expires/created/deadline that are based
      // on the time of the original decision task creation. We must
      // update to the current time, or Taskcluster will reject the
      // task upon creation.
      task.expires = fromNow('366 days');
      task.created = fromNow(0);
      task.deadline = fromNow('1 day');

      task.payload.artifacts.forEach((artifact) => {
        artifact.expires = fromNow('365 days');
      });

      return task;
    },
  };
})();

export default taskcluster;
