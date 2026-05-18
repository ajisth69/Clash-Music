import { getHistory, getLastPlayed, getEQCustom } from '../storage.js';

describe('storage.js readJSON fallback handling', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('should return fallback value [] when localStorage contains invalid JSON for getHistory', () => {
    // Set invalid JSON
    localStorage.setItem('clash_history', '{invalid: json}');

    // Attempt to read, should return the fallback (an empty array for history)
    const history = getHistory();

    expect(history).toEqual([]);
  });

  it('should return parsed JSON when localStorage contains valid JSON for getHistory', () => {
    // Set valid JSON
    const validData = [{ id: '1', title: 'Song 1' }];
    localStorage.setItem('clash_history', JSON.stringify(validData));

    // Attempt to read, should return the parsed data
    const history = getHistory();

    expect(history).toEqual(validData);
  });

  it('should return fallback value [] when localStorage is empty (null) for getHistory', () => {
    const history = getHistory();
    expect(history).toEqual([]);
  });

  it('should return fallback value null when localStorage contains invalid JSON for getLastPlayed', () => {
    localStorage.setItem('clash_lastPlayed', '{invalid: "json"');
    const lastPlayed = getLastPlayed();
    expect(lastPlayed).toBeNull();
  });

  it('should return fallback value [0,0,0,0,0] when localStorage contains invalid JSON for getEQCustom', () => {
    localStorage.setItem('clash_eq_custom', '[1,2,invalid');
    const eqCustom = getEQCustom();
    expect(eqCustom).toEqual([0, 0, 0, 0, 0]);
  });
});
