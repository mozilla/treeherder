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

    // For repos transitioning from hg to git, store git link info
    // so per-push components can choose the right URL.
    if (this.git_url) {
      const branch = this.git_branch || 'main';
      this.gitRevisionHrefPrefix = `${this.git_url}/commit/`;
      this.gitPushLogUrl = `${this.git_url}/commits/${branch}`;
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

  getRevisionHref(revision, isGitRevision = false) {
    if (isGitRevision && this.gitRevisionHrefPrefix) {
      return `${this.gitRevisionHrefPrefix}${revision}`;
    }
    return `${this.revisionHrefPrefix}${revision}`;
  }

  getPushLogHref(revision, isGitRevision = false) {
    if (this.dvcs_type === 'git' || (isGitRevision && this.git_url)) {
      return this.getRevisionHref(revision, isGitRevision);
    }
    return `${this.pushLogUrl}?changeset=${revision}`;
  }

  getPushLogRangeHref(params) {
    const { fromchange, tochange } = params;

    return this.dvcs_type === 'git'
      ? `${this.url}/compare/${fromchange}...${tochange}`
      : `${this.pushLogUrl}?${new URLSearchParams(params).toString()}`;
  }

  getRevisionBaseUrl(isGitRevision = false) {
    if (isGitRevision && this.git_url) {
      return this.git_url;
    }
    return this.url;
  }
}
