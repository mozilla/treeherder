import { linkifyURLs, linkifyRevisions } from '../../../ui/helpers/url';

describe('linkifyURLs helper', () => {

  it('linkifies a URL', () => {
    expect(linkifyURLs('https://www.mozilla.org'))
      .toEqual('[https://www.mozilla.org](https://www.mozilla.org)');
  });

  it('does not linkify a non-URL', () => {
    expect(linkifyURLs('h tee tee pee ess')).toEqual('h tee tee pee ess');
  });

  it('linkifies a mix of URL and non-URL', () => {
    expect(linkifyURLs('This is a test: https://www.mozilla.org Did I pass?'))
      .toEqual('This is a test: [https://www.mozilla.org](https://www.mozilla.org) Did I pass?');
  });
});

describe('linkifyRevisions helper', () => {
  let repo;

  beforeEach((() => {
    repo = {
      id: 1,
      repository_group: {
        description: '',
        name: 'development',
      },
      name: 'mozilla-central',
      dvcs_type: 'hg',
      url: 'https://hg.mozilla.org/mozilla/central',
    };
  }));

  it('linkifies a 20 char revision', () => {
    expect(linkifyRevisions('1234567890ab', repo))
      .toEqual('[1234567890ab](https://hg.mozilla.org/mozilla/central/rev/1234567890ab)');
  });

  it('linkifies a 40 char revision', () => {
    expect(linkifyRevisions('dec7c40f3be3fc3e2b0a7c7f968757a9541b5efb', repo))
      .toEqual('[dec7c40f3be3fc3e2b0a7c7f968757a9541b5efb](https://hg.mozilla.org/mozilla/central/rev/dec7c40f3be3fc3e2b0a7c7f968757a9541b5efb)');
  });

  it('does not linkify a non revision', () => {
    expect(linkifyRevisions('Sweet and sour', repo))
      .toEqual('Sweet and sour');
  });
});

