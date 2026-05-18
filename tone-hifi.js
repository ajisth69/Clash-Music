import * as Tone from 'tone';

export class HiFiDSP {
  constructor() {
    this.player = null;

    // Tone.EQ3: Boost the low (+3dB) and high (+4dB) to simulate hardware clarity.
    this.eq = new Tone.EQ3({
      low: 3,
      mid: 0,
      high: 4
    });

    // Tone.Chebyshev: Apply a very subtle amount of harmonic distortion (warmth/saturation)
    // Order 2 or 3 to mimic a physical amplifier tube.
    this.chebyshev = new Tone.Chebyshev(2);
    this.chebyshev.wet.value = 0.5; // Very subtle

    // Tone.MultibandCompressor: Keep the frequencies tight and prevent clipping
    this.compressor = new Tone.MultibandCompressor({
      low: { threshold: -24 },
      mid: { threshold: -24 },
      high: { threshold: -24 }
    });

    this.effectsEnabled = true;
  }

  buildChain() {
    if (this.player) {
        this.player.disconnect();

        if (this.effectsEnabled) {
            // Chain them correctly: Player -> EQ3 -> Chebyshev -> Compressor -> Tone.Destination
            this.player.chain(this.eq, this.chebyshev, this.compressor, Tone.Destination);
        } else {
            // Bypass chain
            this.player.connect(Tone.Destination);
        }
    }
  }

  async playStream(url) {
    await Tone.start();

    if (this.player) {
      this.player.stop();
      this.player.dispose();
    }

    // Initialize Tone.Player with autostart: true
    this.player = new Tone.Player({
      url: url,
      autostart: true,
      onload: () => {
          console.log("Stream loaded!");
      },
      onerror: (e) => {
          console.error("Stream error", e);
      }
    });

    this.buildChain();
  }

  toggleEffects() {
      this.effectsEnabled = !this.effectsEnabled;
      this.buildChain();
      return this.effectsEnabled;
  }
}

export const hifiDSP = new HiFiDSP();
