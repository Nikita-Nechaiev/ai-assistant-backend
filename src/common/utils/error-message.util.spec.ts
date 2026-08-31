import { getErrorMessage } from './error-message.util';

describe('getErrorMessage', () => {
  it('returns message from Error instances', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns message from error-like objects', () => {
    expect(getErrorMessage({ message: 'failed' })).toBe('failed');
  });

  it('returns fallback for unknown values', () => {
    expect(getErrorMessage('oops', 'fallback')).toBe('fallback');
  });
});
