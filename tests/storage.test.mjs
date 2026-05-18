import test from 'node:test';
import assert from 'node:assert';

const store = new Map();
global.localStorage = {
  getItem: (key) => store.get(key) || null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear()
};

const storage = await import('../storage.js');

test('Volume', async (t) => {
    store.clear();
    assert.strictEqual(storage.getVolume(), 0.7);
    storage.saveVolume(0.5);
    assert.strictEqual(storage.getVolume(), 0.5);
});

test('LastPlayed', async (t) => {
    store.clear();
    assert.strictEqual(storage.getLastPlayed(), null);
    storage.saveLastPlayed({ id: '1', title: 'song1' });
    assert.deepStrictEqual(storage.getLastPlayed(), { id: '1', title: 'song1' });
});

test('Queue', async (t) => {
    store.clear();
    assert.deepStrictEqual(storage.getQueue(), []);
    assert.strictEqual(storage.getQueueIdx(), 0);
    storage.saveQueue([{ id: '1' }, { id: '2' }], 1);
    assert.deepStrictEqual(storage.getQueue(), [{ id: '1' }, { id: '2' }]);
    assert.strictEqual(storage.getQueueIdx(), 1);
});

test('History', async (t) => {
    store.clear();
    assert.deepStrictEqual(storage.getHistory(), []);
    storage.addToHistory({ id: '1', title: 'song1' });
    assert.deepStrictEqual(storage.getHistory(), [{ id: '1', title: 'song1' }]);
    storage.addToHistory({ id: '2', title: 'song2' });
    assert.deepStrictEqual(storage.getHistory(), [{ id: '2', title: 'song2' }, { id: '1', title: 'song1' }]);
    storage.addToHistory({ id: '1', title: 'song1' });
    assert.deepStrictEqual(storage.getHistory(), [{ id: '1', title: 'song1' }, { id: '2', title: 'song2' }]);
});

test('PlayLog', async (t) => {
    store.clear();
    const originalDateNow = Date.now;
    try {
        Date.now = () => 1000;

        assert.deepStrictEqual(storage.getPlayLog(), []);
        storage.logPlay({ id: '1', title: 'song1' }, 50);
        let log = storage.getPlayLog();
        assert.strictEqual(log.length, 1);
        assert.strictEqual(log[0].id, '1');
        assert.strictEqual(log[0].completion, 50);

        // update completion within 10s
        storage.logPlay({ id: '1', title: 'song1' }, 80);
        log = storage.getPlayLog();
        assert.strictEqual(log.length, 1);
        assert.strictEqual(log[0].completion, 80);

        // new song
        Date.now = () => 12000;
        storage.logPlay({ id: '2', title: 'song2' }, 100);
        log = storage.getPlayLog();
        assert.strictEqual(log.length, 2);
        assert.strictEqual(log[0].id, '2');
    } finally {
        Date.now = originalDateNow;
    }
});

test('HeardSongIds', async (t) => {
    store.clear();
    const originalDateNow = Date.now;
    try {
        Date.now = () => 1000;
        storage.logPlay({ id: '1' }, 60);
        Date.now = () => 15000;
        storage.logPlay({ id: '2' }, 80);
        const heard = storage.getHeardSongIds(70);
        assert.strictEqual(heard.has('1'), false);
        assert.strictEqual(heard.has('2'), true);
    } finally {
        Date.now = originalDateNow;
    }
});

test('Liked', async (t) => {
    store.clear();
    assert.deepStrictEqual(storage.getLiked(), []);
    assert.strictEqual(storage.isLiked('1'), false);

    assert.strictEqual(storage.toggleLike({ id: '1', title: 'song1' }), true);
    assert.strictEqual(storage.isLiked('1'), true);
    assert.deepStrictEqual(storage.getLiked(), [{ id: '1', title: 'song1' }]);

    assert.strictEqual(storage.toggleLike({ id: '1', title: 'song1' }), false);
    assert.strictEqual(storage.isLiked('1'), false);
    assert.deepStrictEqual(storage.getLiked(), []);
});

test('AdvancedTasteEngine', async (t) => {
    store.clear();
    assert.deepStrictEqual(storage.getTopArtistsAdvanced(), []);
    assert.deepStrictEqual(storage.getTasteQueries(), []);
    assert.strictEqual(storage.getTasteSummary(), null);

    const originalDateNow = Date.now;
    try {
        Date.now = () => 1000;

        storage.logPlay({ id: '1', artist: 'ArtistA', title: 'love song', language: 'hindi' }, 100);
        storage.toggleLike({ id: '2', artist: 'ArtistB', title: 'party song', language: 'punjabi' });

        const topArtists = storage.getTopArtistsAdvanced();
        assert.strictEqual(topArtists.length, 2);
        // ArtistB should have higher score due to like (+3.0) vs logPlay (+w)
        assert.strictEqual(topArtists[0].name, 'ArtistB');
        assert.strictEqual(topArtists[1].name, 'ArtistA');

        const queries = storage.getTasteQueries();
        assert.ok(queries.length > 0);

        const summary = storage.getTasteSummary();
        assert.strictEqual(summary.totalListened, 1);
        assert.strictEqual(summary.totalLiked, 1);
    } finally {
        Date.now = originalDateNow;
    }
});

test('Playlists', async (t) => {
    store.clear();
    assert.deepStrictEqual(storage.getPlaylists(), []);

    const p1 = storage.createPlaylist('My Playlist');
    assert.ok(p1.id.startsWith('pl_'));
    assert.strictEqual(p1.name, 'My Playlist');
    assert.deepStrictEqual(p1.songs, []);

    let res = storage.addToPlaylist(p1.id, { id: 'song1' });
    assert.strictEqual(res, 'added');
    res = storage.addToPlaylist(p1.id, { id: 'song1' });
    assert.strictEqual(res, 'duplicate');

    let playlists = storage.getPlaylists();
    assert.strictEqual(playlists[0].songs.length, 1);

    assert.strictEqual(storage.removeFromPlaylist(p1.id, 'song1'), true);
    assert.strictEqual(storage.removeFromPlaylist(p1.id, 'song1'), false);

    const p2 = storage.importPlaylist('Imported', [{ id: 's1' }, { id: 's2' }]);
    assert.strictEqual(p2.songs.length, 2);

    assert.strictEqual(storage.deletePlaylist(p1.id), true);
    playlists = storage.getPlaylists();
    assert.strictEqual(playlists.length, 1);
    assert.strictEqual(playlists[0].id, p2.id);
});

test('Settings - EQ', async (t) => {
    store.clear();
    assert.strictEqual(storage.getEQPreset(), 'Flat');
    storage.saveEQPreset('Rock');
    assert.strictEqual(storage.getEQPreset(), 'Rock');

    assert.deepStrictEqual(storage.getEQCustom(), [0, 0, 0, 0, 0]);
    storage.saveEQCustom([1, 2, 3, 4, 5]);
    assert.deepStrictEqual(storage.getEQCustom(), [1, 2, 3, 4, 5]);
});

test('Settings - Visualizer', async (t) => {
    store.clear();
    assert.strictEqual(storage.getVisualizerEnabled(), true);
    storage.saveVisualizerEnabled(false);
    assert.strictEqual(storage.getVisualizerEnabled(), false);

    assert.strictEqual(storage.getVisualizerMode(), 'bars');
    storage.saveVisualizerMode('wave');
    assert.strictEqual(storage.getVisualizerMode(), 'wave');
});

test('Settings - Crossfade', async (t) => {
    store.clear();
    assert.strictEqual(storage.getCrossfadeEnabled(), false);
    storage.saveCrossfadeEnabled(true);
    assert.strictEqual(storage.getCrossfadeEnabled(), true);

    assert.strictEqual(storage.getCrossfadeDuration(), 5);
    storage.saveCrossfadeDuration(10);
    assert.strictEqual(storage.getCrossfadeDuration(), 10);
});

test('Settings - Misc', async (t) => {
    store.clear();
    assert.strictEqual(storage.getGapless(), false);
    storage.saveGapless(true);
    assert.strictEqual(storage.getGapless(), true);

    assert.strictEqual(storage.getTheme(), 'dark');
    storage.saveTheme('light');
    assert.strictEqual(storage.getTheme(), 'light');

    assert.deepStrictEqual(storage.getRecentSearches(), []);
    storage.addRecentSearch('query1');
    storage.addRecentSearch('query2');
    storage.addRecentSearch('query1');
    assert.deepStrictEqual(storage.getRecentSearches(), ['query1', 'query2']);
    storage.clearRecentSearches();
    assert.deepStrictEqual(storage.getRecentSearches(), []);

    assert.strictEqual(storage.getSleepTimer(), null);
    storage.saveSleepTimer(12345);
    assert.strictEqual(storage.getSleepTimer(), 12345);
    storage.clearSleepTimer();
    assert.strictEqual(storage.getSleepTimer(), null);

    assert.strictEqual(storage.getSpatialAudioEnabled(), false);
    storage.saveSpatialAudioEnabled(true);
    assert.strictEqual(storage.getSpatialAudioEnabled(), true);

    assert.strictEqual(storage.getSpatialMode(), 'normal');
    storage.saveSpatialMode('cave');
    assert.strictEqual(storage.getSpatialMode(), 'cave');

    assert.strictEqual(storage.getHiFiMode(), false);
    storage.saveHiFiMode(true);
    assert.strictEqual(storage.getHiFiMode(), true);
});
