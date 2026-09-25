import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';

import UserModel from '../models/user';
import { parseQueryParams } from '../helpers/url';

import PushList from './PushList';
import PushDetail from './PushDetail';
import AuthorPrompt from './AuthorPrompt';
import { AUTHOR_STORAGE_KEY } from './helpers';

import '../css/push-view.css';

// The rest of Treeherder is laid out for a desktop and relies on the browser
// zooming it out on a phone. Only this view opts in to device width, and only
// while it's mounted. theme-color tints Chrome's toolbar on Android (and
// Safari's on iOS) to match the page instead of sitting on it as a white bar.
const HEAD_TAGS = [
  {
    name: 'viewport',
    content:
      'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content',
  },
  {
    name: 'theme-color',
    content: '#f6f6f3',
    media: '(prefers-color-scheme: light)',
  },
  {
    name: 'theme-color',
    content: '#0e1013',
    media: '(prefers-color-scheme: dark)',
  },
];

const useMobileHead = () => {
  useEffect(() => {
    const tags = HEAD_TAGS.map((attrs) => {
      const meta = document.createElement('meta');
      for (const [k, v] of Object.entries(attrs)) meta.setAttribute(k, v);
      document.head.appendChild(meta);
      return meta;
    });
    document.body.classList.add('pv-body');
    return () => {
      for (const meta of tags) meta.remove();
      document.body.classList.remove('pv-body');
    };
  }, []);
};

const useAuthor = (fromUrl) => {
  const [author, setAuthor] = useState(
    fromUrl || localStorage.getItem(AUTHOR_STORAGE_KEY),
  );
  const [checked, setChecked] = useState(!!author);

  useEffect(() => {
    if (author) return;
    UserModel.get()
      .then((user) => user.email && setAuthor(user.email))
      .catch(() => {})
      .finally(() => setChecked(true));
  }, [author]);

  const remember = (email) => {
    localStorage.setItem(AUTHOR_STORAGE_KEY, email);
    setAuthor(email);
  };

  return { author, checked, remember };
};

const PushViewApp = () => {
  useMobileHead();
  const { search } = useLocation();
  const params = parseQueryParams(search);
  const repo = params.repo || 'try';
  const { author, checked, remember } = useAuthor(params.author);

  let screen;
  if (params.revision) {
    screen = <PushDetail repo={repo} revision={params.revision} />;
  } else if (author) {
    screen = (
      <PushList repo={repo} author={author} onChangeAuthor={() => remember('')} />
    );
  } else if (checked) {
    screen = <AuthorPrompt onSubmit={remember} />;
  }

  return <main className="pv">{screen}</main>;
};

export default PushViewApp;
