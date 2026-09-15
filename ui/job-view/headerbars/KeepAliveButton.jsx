import { Button } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMugHot } from '@fortawesome/free-solid-svg-icons';

import {
  usePollControlStore,
  toggleKeepAlive,
} from '../../shared/stores/pollControlStore';

// Toolbar toggle (a coffee mug) that keeps a backgrounded tab polling for the
// longer idle window. Filled/active mug = keep-alive on (12h); muted mug =
// default (2h). While polling is paused from inactivity, shows an indicator.
export default function KeepAliveButton() {
  const keepAlive = usePollControlStore((state) => state.keepAlive);
  const pollingPaused = usePollControlStore((state) => state.pollingPaused);

  const title = keepAlive
    ? 'Keep-alive on: this tab keeps updating in the background for up to 12 hours. Click to return to the 2 hour default.'
    : 'Keep-alive off: background updates stop after 2 hours of inactivity. Click to extend to 12 hours.';

  return (
    <>
      {pollingPaused && (
        <span
          className="navbar-badge badge badge-warning badge-pill"
          id="polling-paused-indicator"
          title="Background updates paused after inactivity. Focus this tab to resume."
        >
          Updates paused
        </span>
      )}
      <Button
        size="sm"
        className={`btn-view-nav nav-menu-btn${keepAlive ? ' active' : ''}`}
        onClick={toggleKeepAlive}
        aria-pressed={keepAlive}
        title={title}
        id="keep-alive-btn"
      >
        <FontAwesomeIcon
          icon={faMugHot}
          className={keepAlive ? undefined : 'text-muted'}
          title="keep-alive"
        />
      </Button>
    </>
  );
}
