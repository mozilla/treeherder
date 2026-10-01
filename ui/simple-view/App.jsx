import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import UserModel from '../models/user';
import { parseQueryParams } from '../helpers/url';

import PushList from './PushList';
import PushDetail from './PushDetail';
import JobSummary from './JobSummary';
import AuthorPrompt from './AuthorPrompt';
import { pushUrl } from './helpers';
import { useTheme } from './theme';
import { BETA, FEEDBACK_URL } from './strings';

// Treeherder's job-state colours (--status-*), shared with the full view.
import '../css/treeherder-job-buttons.css';
import '../css/simple-view.css';

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
  // Treeherder's top bar, so the browser's toolbar runs into it.
  { name: 'theme-color', content: 'rgb(34, 34, 34)' },
];

const useMobileHead = () => {
  useEffect(() => {
    const tags = HEAD_TAGS.map((attrs) => {
      const meta = document.createElement('meta');
      for (const [k, v] of Object.entries(attrs)) meta.setAttribute(k, v);
      document.head.appendChild(meta);
      return meta;
    });
    document.body.classList.add('sv-body');
    return () => {
      for (const meta of tags) meta.remove();
      document.body.classList.remove('sv-body');
    };
  }, []);
};

// Whose pushes: the URL says, so any screen can be shared or bookmarked. With
// no author in it, fill in the signed-in user; failing that, ask. An empty
// `author=` asks on purpose, for switching person.
const useAuthorInUrl = (params, repo) => {
  const navigate = useNavigate();
  const asking = 'author' in params && !params.author;
  const [checked, setChecked] = useState(false);
  const needsOne = !params.revision && !('author' in params);

  useEffect(() => {
    if (!needsOne) return;
    let live = true;
    UserModel.get()
      .then((user) => {
        if (live && user.email) {
          navigate(pushUrl({ repo, author: user.email }), { replace: true });
        }
      })
      .catch(() => {})
      .finally(() => live && setChecked(true));
    return () => {
      live = false;
    };
  }, [needsOne, repo, navigate]);

  const choose = (email) => navigate(pushUrl({ repo, author: email }));

  return { author: params.author || null, asking: asking || checked, choose };
};

const SimpleViewApp = () => {
  useMobileHead();
  const theme = useTheme();
  const { search } = useLocation();
  const params = parseQueryParams(search);
  const repo = params.repo || 'try';
  const { author, asking, choose } = useAuthorInUrl(params, repo);
  const shared = { repo, author, theme };

  let screen;
  if (params.revision && params.job) {
    screen = (
      <JobSummary {...shared} revision={params.revision} jobId={params.job} />
    );
  } else if (params.revision) {
    screen = <PushDetail {...shared} revision={params.revision} />;
  } else if (author) {
    screen = <PushList {...shared} />;
  } else if (asking) {
    screen = <AuthorPrompt {...shared} onSubmit={choose} />;
  }

  return (
    <main className="sv">
      {screen}
      <p className="sv-beta-note">
        {BETA.note}{' '}
        <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">
          {BETA.report}
        </a>
      </p>
    </main>
  );
};

export default SimpleViewApp;
