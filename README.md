 <h1>Clash Musics</h1>
  <p><strong>Because listening to music shouldn't feel like a compromise.</strong></p>
  <p>Imagine if your favorite music app actually cared about audio quality. That's Clash Musics. We stripped out all the bloat and built a lightning-fast, premium web player powered by a true Node.js backend. Get ready to experience studio-grade 320kbps audio, massive hardware-level EQ boosts, and 3D spatial reverb modes that put you right inside the concert hall.</p>

  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fajisth69%2FClash-Music"><img src="https://vercel.com/button" alt="Deploy with Vercel"/></a>
</div>

---

## 👋 Hey there, audiophiles!

Ever noticed how most web music players sound a bit... flat? That's because they are. Most streaming sites compress the life out of your music and trap you in standard stereo. 

I built **Clash Musics** to fix that. 

This isn't just another frontend wrapper. Under the hood, a custom **Node.js Proxy Engine** forces uncompressed, pristine 320kbps streams to load directly to your browser. Then, our custom **Web Audio API** stack intercepts the sound before it hits your speakers, applying the exact same hardware-level Digital Signal Processing (DSP) that high-end smartphones use to make audio sound huge.

### 🎧 The Vibe Check (Features)

- **The Hi-Fi "Exciter" Switch:** Toggle Hi-Fi on, and the engine instantly injects a +35% volume multiplier, a massive +6.5dB bass punch right at the 110Hz sweet spot (perfect for phones), and a crisp +5.5dB treble boost. Your music will instantly sound twice as expensive.
- **7 Spatial Reverb Dimensions:** Normal stereo is boring. With our `ConvolverNode` engine, you can transport your music into a **Concert Hall**, a bouncing **Cave**, a haunting **Cathedral**, or a tight **Studio**. It's true 3D audio, rendered live.
- **Buttery Smooth Mobile Experience:** I hated how web apps feel laggy on phones. So I killed the 300ms tap delay, added GPU acceleration to the song cards so they tilt at a flawless 60fps, and locked down the overscroll so you don't accidentally swipe back while browsing. It feels exactly like a native app.
- **Serverless Ready:** The entire backend runs on pure, native Node.js. No massive `node_modules` folders. No heavy frameworks. It cold-starts on Vercel in milliseconds.

---

## 🚀 How to spin it up

Want to run it locally? It takes literal seconds. Since there are absolutely zero NPM dependencies required to run the core server, you just pull it and run it.

```bash
git clone https://github.com/ajisth69/Clash-Music.git
cd Clash-Music
node server.js
```
Then just pop open `http://localhost:3001` and put your headphones on.

---

## 🛠️ What makes it tick?

* **Backend:** Native Node.js (`http`, `https`)
* **Audio Engine:** Web Audio API (`BiquadFilterNode`, `ConvolverNode`)
* **Frontend:** Vanilla JS, Glassmorphism CSS, HTML5
* **Data:** Proxied JioSaavn API network with a self-healing recursive failover pool.

---

<div align="center">
  <sub>Built with ❤️ for people who actually care about how their music sounds.</sub>
</div>
