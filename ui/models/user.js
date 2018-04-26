import { getApiUrl } from '../helpers/url';

const uri = getApiUrl('/user/');

export default class UserModel {
  constructor(data) {
    Object.assign(this, data);
    this.isStaff = data.is_staff;
  }

  static get() {
    // TODO: The credentials param can be removed in July once Firefox 62 ships and it is the default.
    return fetch(`${uri}`, { credentials: 'same-origin' })
      .then(resp => resp.json().then(data => (
        data.length > 0 ? new UserModel(data[0]) : {}
      )));
  }
}
