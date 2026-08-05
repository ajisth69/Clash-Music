/**
 * Service to parse uploaded playlist files (.csv, .txt)
 * Extracts song names and artist names for importing.
 */

export async function parsePlaylistFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        let tracks = [];
        let playlistName = file.name.replace(/\.[^/.]+$/, ""); // fallback name

        if (file.name.toLowerCase().endsWith('.csv')) {
          tracks = parseCSV(content);
        } else if (file.name.toLowerCase().endsWith('.txt')) {
          tracks = parseTXT(content);
        } else {
          throw new Error("Unsupported file format. Please upload a .txt or .csv file.");
        }

        if (tracks.length === 0) {
          throw new Error("No readable tracks found in this file.");
        }

        resolve({ name: playlistName, tracks });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  
  // Find indices for Track and Artist
  let trackIdx = headers.findIndex(h => h.includes('track') || h.includes('title') || h.includes('song'));
  let artistIdx = headers.findIndex(h => h.includes('artist'));

  // Fallback: assume first column is Track, second is Artist
  if (trackIdx === -1) trackIdx = 0;
  if (artistIdx === -1 && headers.length > 1) artistIdx = 1;

  const tracks = [];
  for (let i = 1; i < lines.length; i++) {
    // Simple CSV split (doesn't handle commas inside quotes perfectly, but good enough for simple exports)
    const row = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, '')); 
    if (row.length > trackIdx && row[trackIdx]) {
      const songName = row[trackIdx];
      const artistName = row.length > artistIdx ? row[artistIdx] : '';
      tracks.push({ songName, artistName });
    }
  }
  return tracks;
}

function parseTXT(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  const tracks = [];

  for (const line of lines) {
    // Usually TuneMyMusic exports TXT as "Song Name - Artist Name" or just lines of text
    // We'll split by " - " or "-" if it exists
    const parts = line.split(/\s+-\s+/);
    if (parts.length >= 2) {
      tracks.push({
        songName: parts[0].trim(),
        artistName: parts[1].trim()
      });
    } else {
      // No clear artist delimiter, just search the whole string in Music API
      tracks.push({
        songName: line.trim(),
        artistName: ''
      });
    }
  }
  return tracks;
}
