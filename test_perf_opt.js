const fs = require('fs');

// Simple mock for Api
global.Api = {
  searchSongs: async (query, limit) => {
    // Simulate network delay
    await new Promise(r => setTimeout(r, 50));
    return [{ name: query, artist: 'Test Artist', id: '123' }];
  }
};

global.findBestMatch = () => {
    return { name: 'Test Song', artist: 'Test Artist', id: '123' };
}

global.Storage = {
    importPlaylist: () => {}
}

global.showToast = () => {}
global.showPlaylists = () => {}
global.$ = () => {
    return {
        value: 'Test Playlist',
        dataset: { tab: 'json' },
        classList: { remove: () => {}, add: () => {} },
        style: {},
        textContent: '',
        innerHTML: '',
        disabled: false
    };
}
global.console.log = () => {}

async function runTest() {
    let songQueries = Array.from({length: 50}, (_, i) => ({ name: `Song ${i}`, artist: `Artist ${i}` }));
    let isImporting = false;
    let playlistName = 'Test';
    let failed = 0;
    let skippedNames = [];
    let matched = [];

    const start = performance.now();

    // Limit concurrency to, say, 5 at a time
    const CONCURRENCY = 5;
    let index = 0;
    let activePromises = [];

    const processSong = async (i) => {
        const q = songQueries[i];
        const searchQuery = q.artist ? `${q.name} ${q.artist}` : q.name;
        try {
            const results = await Api.searchSongs(searchQuery, 5);
            if (results?.length) {
                const bestMatch = findBestMatch(q.name, q.artist, results);
                if (bestMatch) {
                    matched.push(bestMatch);
                } else {
                    failed++;
                    skippedNames.push(q.name);
                }
            } else {
                failed++;
                skippedNames.push(q.name);
            }
        } catch {
            failed++;
            skippedNames.push(q.name);
        }
    };

    while (index < songQueries.length) {
        while (activePromises.length < CONCURRENCY && index < songQueries.length) {
            const p = processSong(index).finally(() => {
                activePromises = activePromises.filter(item => item !== p);
            });
            activePromises.push(p);
            index++;
            // small delay between requests?
            await new Promise(r => setTimeout(r, 10)); // to avoid hammering totally at once
        }
        if (activePromises.length > 0) {
            await Promise.race(activePromises);
        }
    }

    await Promise.all(activePromises);

    const end = performance.now();
    console.error(`Total time: ${end - start}ms`);
}

runTest();
