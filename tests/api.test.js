import { jest } from '@jest/globals';
import { searchSongs } from '../api.js';

describe('apiFetch network errors', () => {
  beforeEach(() => {
    if (!global.fetch) {
      global.fetch = jest.fn();
    }
    jest.spyOn(global, 'fetch');
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('handles fetch network rejection gracefully', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await searchSongs('test');

    expect(result).toEqual([]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[API] Network error fetching'),
      'Network error'
    );
  });

  it('handles non-ok HTTP responses gracefully', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500
    });

    const result = await searchSongs('test');

    expect(result).toEqual([]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[API] 500 from backend for')
    );
  });

  it('handles timeout rejection gracefully', async () => {
    jest.useFakeTimers();

    // Create a fetch mock that never resolves, so we can trigger the timeout
    global.fetch.mockImplementationOnce((url, options) => {
      return new Promise((resolve, reject) => {
        // If the signal gets aborted, reject the promise as fetch would
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            reject(new Error('The user aborted a request.'));
          });
        }
      });
    });

    const searchPromise = searchSongs('test');

    // Process microtasks and advance timers
    await Promise.resolve();
    jest.advanceTimersByTime(15000);

    const result = await searchPromise;

    expect(result).toEqual([]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[API] Network error fetching'),
      'The user aborted a request.'
    );

    jest.useRealTimers();
  });
});
