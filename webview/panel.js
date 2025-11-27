(function () {
  const vscode = acquireVsCodeApi();

  const els = {
    explosions: document.getElementById("explosions"),
    blips: document.getElementById("blips"),
    chars: document.getElementById("chars"),
    shake: document.getElementById("shake"),
    sound: document.getElementById("sound"),
    nativeSound: document.getElementById("nativeSound"),
    fireworks: document.getElementById("fireworks"),
    reducedEffects: document.getElementById("reducedEffects"),
    levelLabel: document.getElementById("levelLabel"),
    xpLabel: document.getElementById("xpLabel"),
    barInner: document.getElementById("barInner"),
    resetBtn: document.getElementById("resetBtn"),
    testFireworks: document.getElementById("testFireworks"),
    fwCanvas: document.getElementById("fwCanvas"),
    soundNotice: document.getElementById("soundNotice")
  };

  // WebAudio engine using decoded WAV buffers (used when nativeSound is disabled)
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let actx = null;
  const buffers = { blip: null, boom: null, fireworks: null };
  let audioUnlocked = false;

  async function fetchArrayBuffer(url) {
    const res = await fetch(url);
    return await res.arrayBuffer();
  }

  async function preloadSounds(uris) {
    try {
      actx = actx || new AudioCtx();
      const entries = Object.entries(uris);
      for (const [k, u] of entries) {
        const ab = await fetchArrayBuffer(u);
        buffers[k] = await actx.decodeAudioData(ab);
      }
    } catch {}
  }

  async function unlockAudio() {
    if (audioUnlocked) return;
    try {
      actx = actx || new AudioCtx();
      if (actx.state === 'suspended') await actx.resume();
      audioUnlocked = true;
      // Hide notice when audio is unlocked
      if (els.soundNotice) {
        els.soundNotice.remove();
      }
    } catch {}
  }

  function playWav(kind, opts = {}) {
    try {
      if (!audioUnlocked || !buffers[kind]) return;
      if (actx && actx.state === 'suspended') {
        actx.resume().catch(() => {});
      }
      const src = actx.createBufferSource();
      src.buffer = buffers[kind];
      if (opts.playbackRate && typeof opts.playbackRate === 'number') {
        src.playbackRate.value = Math.max(0.5, Math.min(3.0, opts.playbackRate));
      }
      const gain = actx.createGain();
      gain.gain.value = 0.5;
      src.connect(gain).connect(actx.destination);
      src.start();
    } catch {}
  }

  // Fireworks particles on canvas
  const fw = {
    running: false,
    particles: [],
    start() {
      const canvas = els.fwCanvas;
      canvas.classList.remove("hidden");
      canvas.width = canvas.clientWidth * window.devicePixelRatio;
      canvas.height = canvas.clientHeight * window.devicePixelRatio;
      this.particles = [];
      for (let i = 0; i < 80; i++) {
        this.particles.push({
          x: canvas.width / 2,
          y: canvas.height - 10,
          vx: (Math.random() - 0.5) * 6,
          vy: -Math.random() * 8 - 4,
          life: 60 + Math.random() * 30,
          color: `hsl(${Math.random() * 360}, 90%, 60%)`
        });
      }
      this.running = true;
      this.loop();
      setTimeout(() => this.stop(), 1500);
    },
    stop() {
      this.running = false;
      els.fwCanvas.classList.add("hidden");
    },
    loop() {
      if (!this.running) return;
      const ctx = els.fwCanvas.getContext("2d");
      ctx.clearRect(0, 0, els.fwCanvas.width, els.fwCanvas.height);
      this.particles.forEach(p => {
        p.vy += 0.15;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 1;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 3, 3);
      });
      this.particles = this.particles.filter(p => p.life > 0 && p.y < els.fwCanvas.height);
      requestAnimationFrame(() => this.loop());
    }
  };

  // Wire toggles
  ["explosions", "blips", "chars", "shake", "sound", "nativeSound", "fireworks", "reducedEffects"].forEach(key => {
    els[key].addEventListener("change", () => {
      vscode.postMessage({ type: "toggle", key, value: els[key].checked });
      // Update sound notice visibility when nativeSound or sound toggles change
      if (key === "nativeSound" || key === "sound") {
        updateSoundNotice();
      }
    });
  });

  function updateSoundNotice() {
    if (!els.soundNotice) return;

    // Show notice only if:
    // - Sound is enabled AND
    // - Native sound is disabled (using webview audio) AND
    // - Audio hasn't been unlocked yet
    if (els.sound.checked && !els.nativeSound.checked && !audioUnlocked) {
      els.soundNotice.style.display = "block";
    } else {
      els.soundNotice.style.display = "none";
    }
  }

  els.resetBtn.addEventListener("click", () => vscode.postMessage({ type: "resetXp" }));
  els.testFireworks.addEventListener("click", () => {
    // Just trigger fireworks visually - sound is handled by backend
    fw.start();
  });

  function setState({ xp, level, xpNext, xpLevelStart = 0 }) {
    const current = xp - xpLevelStart;
    const max = xpNext - xpLevelStart;
    els.levelLabel.textContent = `Level: ${level}`;
    els.xpLabel.textContent = `XP: ${xp} / ${xpNext}`;
    const pct = Math.max(0, Math.min(100, (current / Math.max(1, max)) * 100));
    els.barInner.style.width = `${pct}%`;
  }

  window.addEventListener("message", e => {
    const msg = e.data;
    switch (msg.type) {
      case "init":
        // Settings
        els.explosions.checked = msg.settings.explosions;
        els.blips.checked = msg.settings.blips;
        els.chars.checked = msg.settings.chars;
        els.shake.checked = msg.settings.shake;
        els.sound.checked = msg.settings.sound;
        els.nativeSound.checked = msg.settings.nativeSound;
        els.fireworks.checked = msg.settings.fireworks;
        els.reducedEffects.checked = msg.settings.reducedEffects;

        // Preload webview sounds (for when nativeSound is disabled)
        preloadSounds({ blip: msg.soundUris.blip, boom: msg.soundUris.boom, fireworks: msg.soundUris.fireworks });
        // Unlock audio on first interaction
        document.addEventListener('click', unlockAudio, { once: true });
        document.addEventListener('keydown', unlockAudio, { once: true });

        // Update sound notice visibility based on initial settings
        updateSoundNotice();

        setState(msg);
        break;
      case "state":
        setState(msg);
        break;
      case "blip":
        if (msg.enabled) playWav('blip', { playbackRate: msg.pitch ?? 1.0 });
        break;
      case "boom":
        if (msg.enabled) playWav('boom');
        break;
      case "fireworks":
        if (msg.enabled) playWav('fireworks');
        fw.start();
        break;
    }
  });

  // Wait for DOM to be ready before sending ready message
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      vscode.postMessage({ type: "ready" });
    });
  } else {
    vscode.postMessage({ type: "ready" });
  }
})();