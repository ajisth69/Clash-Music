import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import * as api from './api.js';

let originalFetch;

beforeEach(() => {
  originalFetch = global.fetch;
  global.fetch = mock.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
});

test('init() returns true', async () => {
  const result = await api.init();
  assert.strictEqual(result, true);
});

test('getActiveEndpoint() returns /api', () => {
  assert.strictEqual(api.getActiveEndpoint(), '/api');
});

test('searchSongs() handles valid query', async () => {
  const mockData = {
    data: {
      results: [{
        id: '123',
        name: 'Test Song',
        artist: 'Test Artist',
        album: { id: 'a1', name: 'Test Album' },
        image: 'http://image.url',
        downloadUrl: 'http://stream.url',
        duration: 120
      }]
    }
  };

  global.fetch.mock.mockImplementationOnce(async () => {
    return {
      ok: true,
      json: async () => mockData
    };
  });

  const songs = await api.searchSongs('test query');

  assert.strictEqual(songs.length, 1);
  assert.strictEqual(songs[0].id, '123');
  assert.strictEqual(songs[0].title, 'Test Song');
  assert.strictEqual(songs[0].artist, 'Test Artist');

  // Verify fetch was called with correct URL
  const fetchCall = global.fetch.mock.calls[0];
  assert.ok(fetchCall.arguments[0].includes('/api/search/songs?query=test%20query'));
});

test('searchSongs() handles empty query', async () => {
  const songs = await api.searchSongs('   ');
  assert.strictEqual(songs.length, 0);
  assert.strictEqual(global.fetch.mock.calls.length, 0);
});

test('getSongById() returns normalized song', async () => {
  const mockData = {
    data: [{
      id: '456',
      name: 'Another Song',
      primaryArtists: 'Artist 1, Artist 2',
      album: 'Another Album',
      image: [{ quality: '500x500', url: 'http://hq.img' }],
      downloadUrl: [{ quality: '320kbps', url: 'http://hq.stream' }]
    }]
  };

  global.fetch.mock.mockImplementationOnce(async () => {
    return {
      ok: true,
      json: async () => mockData
    };
  });

  const song = await api.getSongById('456');

  assert.strictEqual(song.id, '456');
  assert.strictEqual(song.title, 'Another Song');
  assert.strictEqual(song.artist, 'Artist 1, Artist 2');
  assert.strictEqual(song.image, 'http://hq.img');
  assert.strictEqual(song.streamUrl, 'http://hq.stream');

  const fetchCall = global.fetch.mock.calls[0];
  assert.strictEqual(fetchCall.arguments[0], '/api/songs/456');
});

test('getSongById() handles null id', async () => {
  const song = await api.getSongById(null);
  assert.strictEqual(song, null);
  assert.strictEqual(global.fetch.mock.calls.length, 0);
});

test('apiFetch handles non-ok response', async () => {
  // Suppress console.warn for this test to avoid noisy output
  const originalWarn = console.warn;
  console.warn = mock.fn();

  global.fetch.mock.mockImplementationOnce(async () => {
    return {
      ok: false,
      status: 500
    };
  });

  const song = await api.getSongById('err123');
  assert.strictEqual(song, null);

  console.warn = originalWarn;
});

test('apiFetch handles network error', async () => {
  // Suppress console.error for this test
  const originalError = console.error;
  console.error = mock.fn();

  global.fetch.mock.mockImplementationOnce(async () => {
    throw new Error('Network failed');
  });

  const song = await api.getSongById('err456');
  assert.strictEqual(song, null);

  console.error = originalError;
});

test('getLyrics() checks lrclib then jiosaavn', async () => {
  // Mock lrclib returning lyrics
  global.fetch.mock.mockImplementationOnce(async (url) => {
    return {
      ok: true,
      json: async () => ({ syncedLyrics: '[00:00.00] Lrclib lyrics' })
    };
  });

  const lyrics1 = await api.getLyrics('song1', 'Track', 'Artist');
  assert.strictEqual(lyrics1, '[00:00.00] Lrclib lyrics');

  // Mock lrclib failing, then fallback to jiosaavn (via apiFetch)
  let calls = 0;
  global.fetch.mock.mockImplementation(async (url) => {
    calls++;
    if (calls === 1) {
      return { ok: false };
    }
    return {
      ok: true,
      json: async () => ({ data: { lyrics: 'JioSaavn lyrics' } })
    };
  });

  const lyrics2 = await api.getLyrics('song2', 'Track', 'Artist');
  assert.strictEqual(lyrics2, 'JioSaavn lyrics');
});
