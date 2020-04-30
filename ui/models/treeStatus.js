const uri = 'https://treestatus.mozilla-releng.net/trees/';

export default class TreeStatusModel {
  static get(repoName) {
    return fetch(`${uri}${repoName}`)
      .then(async (resp) => {
        if (resp.ok) {
          return resp.json();
        }

        if (resp.status === 404) {
          return Promise.resolve({
            result: {
              status: 'unsupported',
              message_of_the_day: '',
              reason: '',
              tree: repoName,
            },
          });
        }
        throw new Error(await resp.text());
      })
      .catch((reason) =>
        Promise.resolve({
          result: {
            status: 'error',
            message_of_the_day:
              'Unable to connect to the https://mozilla-releng.net/treestatus API',
            reason: reason.toString(),
            tree: repoName,
          },
        }),
      );
  }
}
