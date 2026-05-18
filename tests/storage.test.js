import { addToHistory, getHistory } from '../storage.js';

describe('storage.js', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('addToHistory', () => {
    it('adds a song to history', () => {
        addToHistory({ id: 'song-1' });
        expect(getHistory().length).toBe(1);
        expect(getHistory()[0].id).toBe('song-1');
    });

    it('does not add empty songs', () => {
        addToHistory({});
        addToHistory(null);
        addToHistory(undefined);
        expect(getHistory().length).toBe(0);
    });

    it('moves existing song to top if added again', () => {
        addToHistory({ id: 'song-1' });
        addToHistory({ id: 'song-2' });
        addToHistory({ id: 'song-1' });

        const history = getHistory();
        expect(history.length).toBe(2);
        expect(history[0].id).toBe('song-1');
        expect(history[1].id).toBe('song-2');
    });

    it('truncates history to 50 items and removes the oldest', () => {
      // Seed with 50 items
      // Let's assume index 0 is newest, index 49 is oldest
      const initialHistory = Array.from({ length: 50 }, (_, i) => ({ id: `song-${i}`, title: `Song ${i}` }));
      localStorage.setItem('clash_history', JSON.stringify(initialHistory));

      expect(getHistory().length).toBe(50);

      // Add one more
      const newSong = { id: 'song-new', title: 'New Song' };
      addToHistory(newSong);

      const updatedHistory = getHistory();
      expect(updatedHistory.length).toBe(50);
      expect(updatedHistory[0].id).toBe('song-new');
      expect(updatedHistory[1].id).toBe('song-0');
      expect(updatedHistory[49].id).toBe('song-48');

      expect(updatedHistory.some(s => s.id === 'song-49')).toBe(false);
    });
  });
});
