import { useState } from 'react';

import Nav from './Nav';
import { recentPeople } from './cache';
import { chooseFullView } from './phone';

// Whose pushes to show, as a sentence the field completes: anyone looked at
// lately is one tap away; anyone else is an email address.
const AuthorPrompt = ({ repo, theme, onSubmit }) => {
  const [email, setEmail] = useState('');
  const people = recentPeople();
  const valid = email.includes('@');

  return (
    <>
      <Nav repo={repo} theme={theme} full={`/jobs?repo=${repo}`} />
      <div className="pv-prompt pv-rise">
        <h1 className="pv-headline">Pushes by…</h1>

        {people.length > 0 && (
          <ul className="pv-cards pv-people">
            {people.map((p) => (
              <li key={p.email} className="pv-card">
                <button
                  type="button"
                  className="pv-card-head"
                  onClick={() => onSubmit(p.email)}
                >
                  <span className="pv-test-file">{p.name || p.email}</span>
                  {p.name && <span className="pv-test-dir">{p.email}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="pv-prompt-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onSubmit(email.trim().toLowerCase());
          }}
        >
          <input
            className="pv-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={people.length ? 'name@mozilla.com' : 'you@mozilla.com'}
            aria-label="Author email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="pv-button" type="submit" disabled={!valid}>
            Show pushes
          </button>
        </form>

        <a
          className="pv-button pv-button-secondary"
          href={`/jobs?repo=${repo}`}
          onClick={chooseFullView}
        >
          Open the full view
        </a>
      </div>
    </>
  );
};

export default AuthorPrompt;
