import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseSong } from './api.js';

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
