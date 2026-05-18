import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseSong, init, getActiveEndpoint, searchSongs, getSongById, getLyrics } from './api.js';

let originalFetch;

beforeEach(() => {
  originalFetch = global.fetch;
  global.fetch = mock.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
});

// --- normaliseSong Tests ---
test('normaliseSong handles null/undefined/falsy inputs', () => {
  assert.equal(normaliseSong(null), null);
  assert.equal(normaliseSong(undefined), null);
  assert.equal(normaliseSong(''), null);
  assert.equal(normaliseSong(false), null);
});

test('normaliseSong parses properties correctly with complete data', () => {
  const input = {
    id: 'song1',
    name: 'Test Song',
    duration: 180,
    language: 'english',
    image: [
      { quality: '150x150', url: 'img150.jpg' },
      { quality: '500x500', url: 'img500.jpg' }
    ],
    downloadUrl: [
      { quality: '160kbps', url: 'stream160.mp3' },
      { quality: '320kbps', url: 'stream320.mp3' }
    ],
    artists: {
      primary: [
        { id: 'art1', name: 'Artist One' },
        { id: 'art2', name: 'Artist Two' }
      ]
    },
    album: {
      id: 'alb1',
      name: 'Album One'
    }
  };

  const expected = {
    id: 'song1',
    title: 'Test Song',
    artist: 'Artist One, Artist Two',
    artists: [
      { id: 'art1', name: 'Artist One' },
      { id: 'art2', name: 'Artist Two' }
    ],
    artistId: 'art1',
    album: 'Album One',
    albumId: 'alb1',
    image: 'img500.jpg',
    streamUrl: 'stream320.mp3',
    duration: 180,
    language: 'english'
  };

  assert.deepEqual(normaliseSong(input), expected);
});

test('normaliseSong falls back correctly for missing image qualities', () => {
  const input = {
    image: [
      { quality: '150x150', url: 'img150.jpg' },
      { quality: '250x250', url: 'img250.jpg' } // No 500x500
    ]
  };

  const expectedImage = 'img250.jpg';
  const result = normaliseSong(input);
  assert.equal(result.image, expectedImage);
});

test('normaliseSong handles string image', () => {
  const input = {
    image: 'img-string.jpg'
  };

  const result = normaliseSong(input);
  assert.equal(result.image, 'img-string.jpg');
});

test('normaliseSong falls back correctly for missing stream qualities', () => {
  const input1 = {
    downloadUrl: [
      { quality: '160kbps', url: 'stream160.mp3' } // No 320kbps
    ]
  };
  assert.equal(normaliseSong(input1).streamUrl, 'stream160.mp3');

  const input2 = {
    downloadUrl: [
      { quality: '96kbps', url: 'stream96.mp3' } // Neither 320 nor 160
    ]
  };
  assert.equal(normaliseSong(input2).streamUrl, 'stream96.mp3');
});

test('normaliseSong handles string downloadUrl', () => {
  const input = {
    downloadUrl: 'stream-string.mp3'
  };
  assert.equal(normaliseSong(input).streamUrl, 'stream-string.mp3');
});

test('normaliseSong handles string primaryArtists', () => {
  const input = {
    primaryArtists: 'Artist One, Artist Two'
  };

  const expectedArtists = [
    { id: '', name: 'Artist One' },
    { id: '', name: 'Artist Two' }
  ];

  const result = normaliseSong(input);
  assert.equal(result.artist, 'Artist One, Artist Two');
  assert.deepEqual(result.artists, expectedArtists);
  assert.equal(result.artistId, '');
});

test('normaliseSong handles string artist', () => {
  const input = {
    artist: 'Artist One, Artist Two'
  };

  const expectedArtists = [
    { id: '', name: 'Artist One' },
    { id: '', name: 'Artist Two' }
  ];

  const result = normaliseSong(input);
  assert.equal(result.artist, 'Artist One, Artist Two');
  assert.deepEqual(result.artists, expectedArtists);
  assert.equal(result.artistId, '');
});

test('normaliseSong handles string album', () => {
  const input = {
    album: 'Album String'
  };

  const result = normaliseSong(input);
  assert.equal(result.album, 'Album String');
  assert.equal(result.albumId, '');
});

test('normaliseSong handles completely empty/missing properties', () => {
  const input = {};
  const expected = {
    id: '',
    title: 'Unknown',
    artist: 'Unknown Artist',
    artists: [],
    artistId: '',
    album: '',
    albumId: '',
    image: '',
    streamUrl: '',
    duration: 0,
    language: ''
  };

  assert.deepEqual(normaliseSong(input), expected);
});

test('normaliseSong handles `title` property instead of `name`', () => {
  const input = {
    title: 'Test Title'
  };
  const result = normaliseSong(input);
  assert.equal(result.title, 'Test Title');
});

// --- api.js general method tests ---
test('init() returns true', async () => {
  const result = await init();
  assert.strictEqual(result, true);
});

test('getActiveEndpoint() returns /api', () => {
  assert.strictEqual(getActiveEndpoint(), '/api');
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

  const songs = await searchSongs('test query');

  assert.strictEqual(songs.length, 1);
  assert.strictEqual(songs[0].id, '123');
  assert.strictEqual(songs[0].title, 'Test Song');
  assert.strictEqual(songs[0].artist, 'Test Artist');

  // Verify fetch was called with correct URL
  const fetchCall = global.fetch.mock.calls[0];
  assert.ok(fetchCall.arguments[0].includes('/api/search/songs?query=test%20query'));
});

test('searchSongs() handles empty query', async () => {
  const songs = await searchSongs('   ');
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

  const song = await getSongById('456');

  assert.strictEqual(song.id, '456');
  assert.strictEqual(song.title, 'Another Song');
  assert.strictEqual(song.artist, 'Artist 1, Artist 2');
  assert.strictEqual(song.image, 'http://hq.img');
  assert.strictEqual(song.streamUrl, 'http://hq.stream');

  const fetchCall = global.fetch.mock.calls[0];
  assert.strictEqual(fetchCall.arguments[0], '/api/songs/456');
});

test('getSongById() handles null id', async () => {
  const song = await getSongById(null);
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

  const song = await getSongById('err123');
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

  const song = await getSongById('err456');
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

  const lyrics1 = await getLyrics('song1', 'Track', 'Artist');
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

  const lyrics2 = await getLyrics('song2', 'Track', 'Artist');
  assert.strictEqual(lyrics2, 'JioSaavn lyrics');
});
