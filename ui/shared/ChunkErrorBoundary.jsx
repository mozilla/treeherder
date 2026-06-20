import React from 'react';
import PropTypes from 'prop-types';

import { isChunkLoadError, reloadOnChunkError } from '../helpers/chunkError';

import LoadingSpinner from './LoadingSpinner';

/**
 * Error boundary for the lazily-loaded routes in App.jsx.
 *
 * `<Suspense>` only handles the pending state of a dynamic import; it does not
 * catch a rejected import. Without this boundary a failure to load a route
 * bundle (a stale chunk removed by a deploy, or a corrupt cached asset) leaves
 * the user stuck on the loading spinner. Here we attempt a one-time recovery
 * reload to pick up the current assets, and otherwise show a readable message
 * instead of spinning forever.
 */
export default class ChunkErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, isChunkError: false, reloadTriggered: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, isChunkError: isChunkLoadError(error) };
  }

  componentDidCatch(error) {
    // For a chunk-load failure, try to reload onto the current assets. The
    // helper reloads at most once per cooldown so it can't loop on a failure a
    // reload won't fix.
    const reloadTriggered = reloadOnChunkError(error);
    if (reloadTriggered) {
      this.setState({ reloadTriggered: true });
    }
  }

  render() {
    const { children = null } = this.props;
    const { hasError, isChunkError, reloadTriggered } = this.state;

    if (!hasError) {
      return children;
    }

    if (isChunkError && reloadTriggered) {
      // A reload is in flight; show the spinner until the page navigates away.
      return (
        <div className="text-center mt-5">
          <LoadingSpinner />
          <p>Reloading to load the latest version…</p>
        </div>
      );
    }

    if (isChunkError) {
      return (
        <div className="text-center mt-5" role="alert">
          <p>Part of the app failed to load.</p>
          <p>
            Please refresh the page. If the problem persists, do a hard refresh
            (Cmd/Ctrl+Shift+R) to clear cached files.
          </p>
        </div>
      );
    }

    return (
      <div className="text-center mt-5" role="alert">
        <p>Something went wrong.</p>
        <p>Please refresh the page to try again.</p>
      </div>
    );
  }
}

ChunkErrorBoundary.propTypes = {
  children: PropTypes.node,
};
