/**
 * Unit tests for the errorMessage helper module.
 *
 * This test suite covers:
 * - formatModelError: Formatting server-side errors
 * - formatTaskclusterError: Formatting Taskcluster errors
 * - processErrorMessage: Processing error messages with status codes
 */

import {
  formatModelError,
  formatTaskclusterError,
  processErrorMessage,
} from '../../../ui/helpers/errorMessage';

describe('formatModelError', () => {
  it('returns auth error message for 401 status', () => {
    const error = { status: 401 };
    const result = formatModelError(error, 'Custom message');

    expect(result).toBe('Please login to Treeherder to complete this action');
  });

  it('returns auth error message for 403 status', () => {
    const error = { status: 403 };
    const result = formatModelError(error, 'Custom message');

    expect(result).toBe('Please login to Treeherder to complete this action');
  });

  it('formats error with data.detail from server response', () => {
    const error = {
      status: 500,
      statusText: 'Internal Server Error',
      data: { detail: 'Database connection failed' },
    };
    const result = formatModelError(error, 'Server error');

    expect(result).toBe(
      'Server error: Database connection failed Internal Server Error',
    );
  });

  it('formats error using status when data.detail is missing', () => {
    const error = {
      status: 404,
      statusText: 'Not Found',
    };
    const result = formatModelError(error, 'Resource not found');

    expect(result).toBe('Resource not found: 404 Not Found');
  });

  it('formats error with empty data object', () => {
    const error = {
      status: 400,
      statusText: 'Bad Request',
      data: {},
    };
    const result = formatModelError(error, 'Bad request');

    expect(result).toBe('Bad request: 400 Bad Request');
  });
});

describe('formatTaskclusterError', () => {
  it('formats error with message property', () => {
    const error = { message: 'Task not found' };
    const result = formatTaskclusterError(error);

    expect(result).toBe('Taskcluster: Task not found');
  });

  it('formats error with body.message property', () => {
    const error = {
      body: { message: 'Authentication failed' },
    };
    const result = formatTaskclusterError(error);

    expect(result).toBe('Taskcluster: Authentication failed');
  });

  it('formats error using toString when no message', () => {
    const error = { toString: () => 'Unknown error occurred' };
    const result = formatTaskclusterError(error);

    expect(result).toBe('Taskcluster: Unknown error occurred');
  });

  it('truncates message at ---- delimiter', () => {
    const error = {
      message:
        'Task failed----Additional debugging information that is very long',
    };
    const result = formatTaskclusterError(error);

    expect(result).toBe('Taskcluster: Task failed');
  });

  it('handles error with empty body (uses body.toString)', () => {
    const error = {
      body: {},
    };
    const result = formatTaskclusterError(error);

    // When body exists but has no message, it uses body.toString()
    expect(result).toBe('Taskcluster: [object Object]');
  });

  it('falls back to error.toString when no body', () => {
    const error = {
      toString: () => 'Fallback error',
    };
    const result = formatTaskclusterError(error);

    expect(result).toBe('Taskcluster: Fallback error');
  });
});

describe('processErrorMessage', () => {
  it('returns server error message for 500+ status', () => {
    const result = processErrorMessage(null, 500);

    expect(result).toBe(
      'There was a problem retrieving the data. Please try again in a minute.',
    );
  });

  it('returns server error message for 503 status', () => {
    const result = processErrorMessage(null, 503);

    expect(result).toBe(
      'There was a problem retrieving the data. Please try again in a minute.',
    );
  });

  it('returns bad request message for 400 status', () => {
    const result = processErrorMessage(null, 400);

    expect(result).toBe('The action resulted in a bad request.');
  });

  it('appends object error details', () => {
    const error = { field: 'This field is required' };
    const result = processErrorMessage(error, 400);

    expect(result).toBe(
      'The action resulted in a bad request. field: This field is required',
    );
  });

  it('appends string error', () => {
    const error = 'Custom error message';
    const result = processErrorMessage(error, 500);

    expect(result).toBe(
      'There was a problem retrieving the data. Please try again in a minute.Custom error message',
    );
  });

  it('returns string error directly for non-special status codes', () => {
    const error = 'Not found';
    const result = processErrorMessage(error, 404);

    expect(result).toBe('Not found');
  });

  it('handles null error with non-special status code', () => {
    const result = processErrorMessage(null, 404);

    expect(result).toBeNull();
  });

  it('handles empty string error', () => {
    const result = processErrorMessage('', 200);

    expect(result).toBe('');
  });

  it('combines 500 error with object error details', () => {
    const error = { username: 'Username already exists' };
    const result = processErrorMessage(error, 500);

    expect(result).toBe(
      'There was a problem retrieving the data. Please try again in a minute. username: Username already exists',
    );
  });
});
