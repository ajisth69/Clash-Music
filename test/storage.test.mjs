import test from 'node:test';
import assert from 'node:assert';

// Mock localStorage
const mockStorage = new Map();
global.localStorage = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, value) => mockStorage.set(key, value),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};

import { toggleLike, isLiked, getLiked } from '../storage.js';

test('toggleLike missing ID handling', (t) => {
  // Clear any existing state
  global.localStorage.clear();

  // Test with object missing ID
  const resultNoId = toggleLike({ title: 'No ID', artist: 'Unknown' });
  assert.strictEqual(resultNoId, false, 'Should return false when song has no ID');

  // Verify storage is still empty
  const likedSongs = getLiked();
  assert.deepStrictEqual(likedSongs, [], 'Liked songs should remain empty');

  // Test with null/undefined
  const resultNull = toggleLike(null);
  assert.strictEqual(resultNull, false, 'Should return false when song is null');
});

test('toggleLike success path', (t) => {
  // Clear any existing state
  global.localStorage.clear();

  const song = { id: 'song_1', title: 'Test Song' };

  // Initial like
  const resultLike = toggleLike(song);
  assert.strictEqual(resultLike, true, 'Should return true when successfully liking a song');
  assert.strictEqual(isLiked('song_1'), true, 'Song should be marked as liked');
  assert.deepStrictEqual(getLiked()[0].id, 'song_1', 'Song should be in liked list');

  // Toggle again (unlike)
  const resultUnlike = toggleLike(song);
  assert.strictEqual(resultUnlike, false, 'Should return false when successfully unliking a song');
  assert.strictEqual(isLiked('song_1'), false, 'Song should not be marked as liked anymore');
  assert.deepStrictEqual(getLiked(), [], 'Liked list should be empty');
});
