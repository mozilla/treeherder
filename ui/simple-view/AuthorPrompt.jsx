import { useState } from 'react';

import Nav from './Nav';
import { clearRecentPeople, recentPeople } from './cache';
import { chooseFullView } from './phone';
import { PICKER } from './strings';

// Whose pushes to show, as a sentence the field completes: anyone looked at
// lately is one tap away; anyone else is an email address.
const AuthorPrompt = ({ repo, theme, onSubmit }) => {
  const [email, setEmail] = useState('');
  const [people, setPeople] = useState(recentPeople);
  const valid = email.includes('@');

  return (
    <>
      <Nav repo={repo} theme={theme} full={`/jobs?repo=${repo}`} />
      <div className="sv-prompt sv-rise">
        <h1 className="sv-headline">{PICKER.title}</h1>

        {people.length > 0 && (
          <div className="sv-people-head">
            <h2 className="sv-section-title">{PICKER.recent}</h2>
            <button
              type="button"
              className="sv-clear"
              onClick={() => {
                clearRecentPeople();
                setPeople([]);
              }}
            >
              {PICKER.clear}
            </button>
          </div>
        )}
        {people.length > 0 && (
          <ul className="sv-cards sv-people">
            {people.map((p) => (
              <li key={p.email} className="sv-card">
                <button
                  type="button"
                  className="sv-card-head"
                  onClick={() => onSubmit(p.email)}
                >
                  <span className="sv-test-file">{p.name || p.email}</span>
                  {p.name && <span className="sv-test-dir">{p.email}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="sv-prompt-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onSubmit(email.trim().toLowerCase());
          }}
        >
          <input
            className="sv-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={PICKER.placeholder(people.length > 0)}
            aria-label={PICKER.emailLabel}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="sv-button" type="submit" disabled={!valid}>
            {PICKER.show}
          </button>
        </form>

        <a
          className="sv-button sv-button-secondary"
          href={`/jobs?repo=${repo}`}
          onClick={chooseFullView}
        >
          {PICKER.openFullView}
        </a>
      </div>
    </>
  );
};

export default AuthorPrompt;
