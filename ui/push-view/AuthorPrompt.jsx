import { useState } from 'react';

const AuthorPrompt = ({ onSubmit }) => {
  const [email, setEmail] = useState('');

  return (
    <form
      className="pv-prompt pv-rise"
      onSubmit={(e) => {
        e.preventDefault();
        if (email.includes('@')) onSubmit(email.trim().toLowerCase());
      }}
    >
      <h1 className="pv-headline">Whose pushes?</h1>
      <p className="pv-sub">
        The address you push to try with. It stays in this browser.
      </p>
      <input
        className="pv-input"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@mozilla.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button className="pv-button" type="submit" disabled={!email.includes('@')}>
        Show my pushes
      </button>
    </form>
  );
};

export default AuthorPrompt;
