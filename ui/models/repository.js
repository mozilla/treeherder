import { getApiUrl, repoEndpoint } from '../helpers/url';

export default class RepositoryModel {
  constructor(props) {
    Object.assign(this, props);

    // FIXME: assuming master branch, which may not
    // always be right -- unfortunately fixing this
    // requires backend changes as we're not storing
    // such info explicitly right now
    if (this.dvcs_type === 'git') {
      this.pushLogUrl = `${this.url}/commits/master`;
      this.revisionHrefPrefix = `${this.url}/commit/`;
    } else {
      this.pushLogUrl = `${this.url}/pushloghtml`;
      this.revisionHrefPrefix = `${this.url}/rev/`;
    }
  }

  static getList() {
    return fetch(getApiUrl(repoEndpoint))
      .then((resp) => resp.json())
      .then((repos) => repos.map((datum) => new RepositoryModel(datum)));
  }

  static getRepo(name, repos) {
    return repos.find((repo) => repo.name === name);
  }

  getRevisionHref(revision) {
    return `${this.revisionHrefPrefix}${revision}`;
  }

  getPushLogHref(revision) {
    return this.dvcs_type === 'git'
      ? this.getRevisionHref(revision)
      : `${this.pushLogUrl}?changeset=${revision}`;
  }

  getPushLogRangeHref(params) {
    const { fromchange, tochange } = params;

    return this.dvcs_type === 'git'
      ? `${this.url}/compare/${fromchange}...${tochange}`
      : `${this.pushLogUrl}?${new URLSearchParams(params).toString()}`;
  }
}
