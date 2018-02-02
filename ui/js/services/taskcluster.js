import { OIDCCredentialAgent, fromNow } from 'taskcluster-client-web';

const thTaskcluster = (() => {
  let credentialAgent = null;

  // Create an OIDC credential agent if it doesn't exist.
  const tcAgent = () => {
    if (credentialAgent) {
      return credentialAgent;
    }

    const userSession = localStorage.getItem('userSession');

    if (userSession) {
      credentialAgent = new OIDCCredentialAgent({
        accessToken: JSON.parse(userSession).accessToken,
        oidcProvider: 'mozilla-auth0'
      });
    }

    return credentialAgent;
  };

  return {
    getAgent: tcAgent,
    // When the access token is refreshed, simply update it on the credential agent
    updateAgent: () => {
      const userSession = localStorage.getItem('userSession');

      if (userSession) {
        tcAgent().accessToken = JSON.parse(userSession).accessToken;
      } else {
        credentialAgent = null;
      }
    },
    getCredentials: () => (credentialAgent ? credentialAgent.getCredentials() : {}),
    refreshTimestamps: function (task) {
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

      _.map(task.payload.artifacts, function (artifact) {
        artifact.expires = fromNow('365 days');
      });

      return task;
    },
  };
})();

export default thTaskcluster;
