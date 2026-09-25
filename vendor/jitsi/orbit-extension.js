(function () {
  "use strict";

  var TRANSLATOR_ID = "orbit-translator";
  var DONATE_ID = "orbit-donate";
  var LIVE_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";
  var DUCKED_VOLUME = 0.15;
  var POLL_MS = 750;
  var MAX_HISTORY = 100;

  var ui = { open: false, target: "en", languages: null };
  var lastAction = { key: "", time: 0 };
  var live = {
    enabled: false,
    generation: 0,
    signature: "",
    socket: null,
    input: null,
    output: null,
    mixer: null,
    processor: null,
    sources: [],
    analysers: [],
    playback: [],
    nextTime: 0,
    ducked: [],
    status: "idle",
    sourceText: "",
    translatedText: "",
    speaker: null,
    history: [],
    finalizeTimer: null,
    reconnectTimer: null,
    reconnects: 0,
    token: "",
    model: "",
    sessionHandle: "",
    mediaSources: []
  };

  function store() { return window.APP && window.APP.store; }
  function api() { return window.APP && window.APP.API; }
  function byId(id) { return document.getElementById(id); }
  function text(value) { return String(value == null ? "" : value); }
  function esc(value) {
    return text(value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function injectStyles() {
    if (byId("orbit-live-style")) return;
    var style = document.createElement("style");
    style.id = "orbit-live-style";
    style.textContent = [
      ":root{--orbit-panel-width:380px;--orbit-bg:#151517;--orbit-surface:#202024;--orbit-surface-2:#29292e;--orbit-border:rgba(255,255,255,.12);--orbit-text:#f7f7f8;--orbit-muted:#a7a7af;--orbit-accent:#8b5cf6;--orbit-danger:#d94d4d}",
      "#orbit-translator-panel{position:fixed;inset:0 auto 0 0;width:min(var(--orbit-panel-width),calc(100vw - 24px));height:100dvh;z-index:10020;display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;background:rgba(21,21,23,.97);color:var(--orbit-text);border-right:1px solid var(--orbit-border);box-shadow:18px 0 48px rgba(0,0,0,.42);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);font-family:Inter,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}",
      "#orbit-translator-panel *{box-sizing:border-box}",
      "#orbit-translator-panel .oh{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:64px;padding:12px 14px 12px 16px;border-bottom:1px solid var(--orbit-border);background:rgba(255,255,255,.015)}",
      "#orbit-translator-panel .ot{font-size:16px;line-height:1.2;font-weight:750;letter-spacing:-.01em}",
      "#orbit-translator-panel button,#orbit-translator-panel select{font:inherit;-webkit-tap-highlight-color:transparent}",
      "#orbit-translator-panel button{transition:background-color .16s ease,border-color .16s ease,transform .12s ease,opacity .16s ease}",
      "#orbit-translator-panel button:active{transform:scale(.98)}",
      "#orbit-translator-panel button:focus-visible,#orbit-translator-panel select:focus-visible{outline:2px solid rgba(139,92,246,.85);outline-offset:2px}",
      "#orbit-translator-panel .oc{display:grid;place-items:center;flex:0 0 auto;width:38px;height:38px;border-radius:12px;border:1px solid var(--orbit-border);background:var(--orbit-surface);color:#fff;cursor:pointer;font-size:22px;line-height:1}",
      "#orbit-translator-panel .oc:hover{background:var(--orbit-surface-2)}",
      "#orbit-translator-panel .ctl{padding:14px 16px 15px;border-bottom:1px solid var(--orbit-border);background:rgba(255,255,255,.01)}",
      "#orbit-translator-panel label{display:block;margin:0 0 8px;font-size:12px;line-height:1.3;font-weight:700;color:#c9c9cf}",
      "#orbit-translator-panel select{display:block;width:100%;height:44px;padding:0 38px 0 12px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:var(--orbit-surface);color:#fff;cursor:pointer;color-scheme:dark}",
      "#orbit-translator-panel .actions{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;margin-top:10px}",
      "#orbit-translator-panel .primary,#orbit-translator-panel .secondary{min-height:44px;border-radius:12px;padding:0 15px;font-weight:750;cursor:pointer;white-space:nowrap}",
      "#orbit-translator-panel .primary{border:1px solid transparent;background:#f4f4f5;color:#111114}",
      "#orbit-translator-panel .primary:hover{background:#fff}",
      "#orbit-translator-panel .primary.running{background:var(--orbit-danger);color:#fff}",
      "#orbit-translator-panel .primary.running:hover{background:#e25757}",
      "#orbit-translator-panel .secondary{border:1px solid var(--orbit-border);background:var(--orbit-surface);color:#fff}",
      "#orbit-translator-panel .secondary:hover{background:var(--orbit-surface-2)}",
      "#orbit-translator-panel .status{display:flex;align-items:center;min-height:42px;padding:9px 16px;border-bottom:1px solid rgba(255,255,255,.08);font-size:12px;line-height:1.4;color:#c8c8ce;background:rgba(255,255,255,.012)}",
      "#orbit-translator-panel .error{margin:12px 14px 0;border:1px solid rgba(255,104,104,.35);background:rgba(160,35,35,.18);border-radius:12px;padding:10px 11px;color:#ffb9b5;font-size:12px;line-height:1.45}",
      "#orbit-translator-panel .scroll{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:12px 14px 18px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.2) transparent}",
      "#orbit-translator-panel .scroll::-webkit-scrollbar{width:8px}",
      "#orbit-translator-panel .scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.16);border-radius:999px}",
      "#orbit-translator-panel .empty{margin-top:2px;border:1px dashed rgba(255,255,255,.15);border-radius:14px;padding:18px 14px;background:rgba(255,255,255,.018);color:var(--orbit-muted);font-size:13px;line-height:1.55}",
      "#orbit-translator-panel .entry{padding:12px 2px 14px;border-bottom:1px solid rgba(255,255,255,.08)}",
      "#orbit-translator-panel .entry:last-child{border-bottom:0}",
      "#orbit-translator-panel .meta{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:7px}",
      "#orbit-translator-panel .speaker{min-width:0;font-size:13px;font-weight:750;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      "#orbit-translator-panel .badge{flex:0 0 auto;font-size:9px;line-height:1;color:#b9b9c0;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.035);padding:4px 7px;border-radius:999px;text-transform:uppercase;letter-spacing:.05em}",
      "#orbit-translator-panel .cap{margin:8px 0 4px;font-size:9px;text-transform:uppercase;letter-spacing:.09em;color:#7f8088;font-weight:800}",
      "#orbit-translator-panel .original{font-size:13.5px;line-height:1.5;color:#bfc0c7;white-space:pre-wrap;overflow-wrap:anywhere}",
      "#orbit-translator-panel .translated{font-size:14px;line-height:1.52;font-weight:600;color:#fff;white-space:pre-wrap;overflow-wrap:anywhere}",
      "#orbit-donate-dialog{position:fixed;z-index:10030;left:50%;top:50%;transform:translate(-50%,-50%);width:min(400px,calc(100vw - 28px));max-height:calc(100dvh - 28px);overflow:auto;background:rgba(21,21,23,.98);color:#fff;border:1px solid var(--orbit-border);border-radius:18px;box-shadow:0 28px 90px rgba(0,0,0,.58);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);padding:20px}",
      "#orbit-donate-dialog button{min-height:42px;border:0;border-radius:11px;padding:0 14px;cursor:pointer;font-weight:750}",
      "@media(max-width:799px){body.orbit-translator-open{overflow:hidden}body.orbit-translator-open:before{content:\"\";position:fixed;inset:0;z-index:10019;background:rgba(0,0,0,.48);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}#orbit-translator-panel{width:min(100vw,430px);max-width:100vw;border-right:1px solid rgba(255,255,255,.1);box-shadow:14px 0 42px rgba(0,0,0,.52)}#orbit-translator-panel .oh{min-height:60px}#orbit-translator-panel .ctl{padding:12px 14px 14px}#orbit-translator-panel .scroll{padding:10px 12px 16px}}",
      "@media(max-width:430px){#orbit-translator-panel{width:100vw;border-right:0}#orbit-translator-panel .actions{grid-template-columns:1fr 92px}#orbit-translator-panel .primary,#orbit-translator-panel .secondary{padding:0 12px}}",
      "@media(prefers-reduced-motion:reduce){#orbit-translator-panel button{transition:none}}"
    ].join("");
    document.head.appendChild(style);
  }

  function statusMessage() {
    if (live.status === "connecting") return "Connecting live translator…";
    if (live.status === "listening") return "Listening to incoming meeting audio.";
    if (live.status === "playing") return "Playing translated audio.";
    if (live.enabled) return "Waiting for incoming participant audio.";
    return "Choose a language and start translation.";
  }

  function setStatus(value) {
    if (value) live.status = value;
    var node = byId("orbit-live-status");
    if (node) node.textContent = statusMessage();
  }

  function showError(message) {
    if (message) live.status = "error";
    var node = byId("orbit-live-error");
    if (node) { node.hidden = !message; node.textContent = message || ""; }
    setStatus();
  }

  function loadLanguages() {
    if (ui.languages) return Promise.resolve(ui.languages);
    return fetch("/api/translation-languages", { headers: { accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error("languages"); return r.json(); })
      .then(function (items) { ui.languages = Array.isArray(items) ? items : []; return ui.languages; });
  }

  function renderPanel() {
    injectStyles();
    var old = byId("orbit-translator-panel");
    if (old) old.remove();
    var root = document.createElement("aside");
    root.id = "orbit-translator-panel";
    root.setAttribute("aria-label", "Live Translator");
    root.innerHTML = '<div class="oh"><div class="ot">Live Translator</div><button class="oc" id="orbit-close" aria-label="Minimize Translator" title="Minimize — translation keeps running">−</button></div>' +
      '<div class="ctl"><label for="orbit-language">Translate incoming audio to</label><select id="orbit-language"><option value="en">English</option></select>' +
      '<div class="actions"><button class="primary" id="orbit-toggle">Start Translation</button><button class="secondary" id="orbit-clear">Clear</button></div></div>' +
      '<div class="status" id="orbit-live-status">' + esc(statusMessage()) + '</div>' +
      '<div class="error" id="orbit-live-error" hidden></div>' +
      '<div class="scroll" id="orbit-transcript"><div class="empty">Incoming participant and shared-screen audio will appear here once Live Translation is started.</div></div>';
    document.body.appendChild(root);
    document.body.classList.add("orbit-translator-open");
    ui.open = true;
    byId("orbit-close").onclick = closePanel;
    byId("orbit-toggle").onclick = function () { live.enabled ? stopTranslation(false) : requestStart(); updateControls(); };
    byId("orbit-clear").onclick = function () { live.history = []; live.sourceText = ""; live.translatedText = ""; renderTranscript(); };
    byId("orbit-language").onchange = function (e) {
      ui.target = e.target.value || "en";
      if (live.enabled) { stopTranslation(true); live.enabled = true; syncTranslation(); }
    };
    loadLanguages().then(function (items) {
      var select = byId("orbit-language");
      if (!select) return;
      select.innerHTML = items.map(function (x) { return '<option value="' + esc(x.code) + '">' + esc(x.name) + '</option>'; }).join("");
      select.value = ui.target;
    }).catch(function () {});
    renderTranscript();
    updateControls();
  }

  function closePanel() {
    ui.open = false;
    document.body.classList.remove("orbit-translator-open");
    var node = byId("orbit-translator-panel");
    if (node) node.remove();
  }

  function toggleTranslator() { ui.open ? closePanel() : renderPanel(); }

  function updateControls() {
    var button = byId("orbit-toggle");
    if (!button) return;
    button.textContent = live.enabled ? "Stop Translation" : "Start Translation";
    button.classList.toggle("running", live.enabled);
    setStatus();
  }

  function participantLabel(id) {
    var s = store();
    if (!s || !id) return "Remote participant";
    var state = s.getState()["features/base/participants"];
    var p = null;
    try {
      if (state && typeof state.get === "function") p = state.get(id);
      if (!p && state && state.remote && typeof state.remote.get === "function") p = state.remote.get(id);
      if (!p && state && state[id]) p = state[id];
    } catch (_) {}
    if (!p) return "Remote participant";
    var name = p.name || p.displayName || p._displayName || p.formattedDisplayName;
    try { if (!name && typeof p.getDisplayName === "function") name = p.getDisplayName(); } catch (_) {}
    return name || "Remote participant";
  }

  function isScreenShareAudio(track, jt, media, sourceName) {
    var sourceId = track.sourceId || jt.sourceId || "";
    var sourceType = track.sourceType || jt.sourceType || "";
    var videoType = track.videoType || "";
    var label = media && media.label || "";
    var settings = {};
    try { if (!videoType && typeof jt.getVideoType === "function") videoType = jt.getVideoType() || ""; } catch (_) {}
    try { if (media && typeof media.getSettings === "function") settings = media.getSettings() || {}; } catch (_) {}
    var hints = [ sourceName, sourceType, videoType, label, settings.displaySurface || "" ].join(" ");

    return !!sourceId || /desktop|screen|window|tab|display|presentation|share/i.test(hints);
  }

  function translatableMedia() {
    var s = store();
    if (!s) return null;
    var tracks = s.getState()["features/base/tracks"] || [];
    var sources = [], signature = [];
    tracks.forEach(function (track) {
      if (!track || track.mediaType !== "audio" || track.muted || !track.jitsiTrack || typeof track.jitsiTrack.getTrack !== "function") return;
      var jt = track.jitsiTrack, media, pid = track.participantId || (track.local ? "local" : "remote"), sourceName = "", trackId = "";
      try {
        media = jt.getTrack();
        if (typeof jt.getParticipantId === "function") pid = jt.getParticipantId() || pid;
        if (typeof jt.getSourceName === "function") sourceName = jt.getSourceName() || "";
        if (typeof jt.getTrackId === "function") trackId = jt.getTrackId() || "";
      } catch (_) { return; }
      if (!media || media.kind !== "audio" || media.readyState !== "live") return;

      var screen = isScreenShareAudio(track, jt, media, sourceName);
      if (track.local && !screen) return;

      trackId = trackId || media.id || "audio";
      var localShare = !!track.local && screen;
      var type = screen ? "screen" : "participant";
      var label = localShare ? "Your shared screen" : participantLabel(pid) + (screen ? " · Shared screen" : "");
      sources.push({ mediaTrack: media, participantId: pid, trackId: trackId, type: type, label: label, localShare: localShare });
      signature.push((track.local ? "local" : "remote") + ":" + pid + ":" + sourceName + ":" + trackId + ":" + type);
    });
    return sources.length ? { sources: sources, signature: signature.sort().join("|") } : null;
  }

  function ensureAudio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error("AudioContext unavailable");
    live.input = live.input || new AC();
    live.output = live.output || new AC();
    live.input.resume().catch(function () {});
    live.output.resume().catch(function () {});
  }

  function duck() {
    if (live.ducked.length) return;
    document.querySelectorAll("audio,video").forEach(function (node) {
      if (node.muted || typeof node.volume !== "number") return;
      var stream = node.srcObject;
      if (stream && stream.getAudioTracks && !stream.getAudioTracks().length) return;
      live.ducked.push({ node: node, volume: node.volume });
      try { node.volume = Math.min(node.volume, DUCKED_VOLUME); } catch (_) {}
    });
  }

  function restoreVolume() {
    live.ducked.forEach(function (x) { try { x.node.volume = x.volume; } catch (_) {} });
    live.ducked = [];
  }

  function stopPlayback() {
    live.playback.forEach(function (x) { try { x.stop(); } catch (_) {} });
    live.playback = [];
    live.nextTime = live.output ? live.output.currentTime : 0;
    restoreVolume();
  }

  function disconnectInput() {
    if (live.processor) { try { live.processor.disconnect(); } catch (_) {} live.processor.onaudioprocess = null; }
    if (live.mixer) try { live.mixer.disconnect(); } catch (_) {}
    live.sources.forEach(function (x) { try { x.disconnect(); } catch (_) {} });
    live.analysers.forEach(function (x) { try { x.node.disconnect(); } catch (_) {} });
    live.processor = live.mixer = null;
    live.sources = []; live.analysers = [];
  }

  function closeSocket() {
    var ws = live.socket; live.socket = null;
    if (!ws) return;
    ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
    try { ws.close(); } catch (_) {}
  }

  function stopTranslation(preserveEnabled) {
    live.generation += 1;
    if (live.finalizeTimer) clearTimeout(live.finalizeTimer);
    if (live.reconnectTimer) clearTimeout(live.reconnectTimer);
    live.finalizeTimer = live.reconnectTimer = null;
    finalizeTurn();
    disconnectInput(); closeSocket(); stopPlayback();
    live.signature = ""; live.sessionHandle = ""; live.reconnects = 0; live.mediaSources = [];
    live.enabled = !!preserveEnabled;
    live.status = preserveEnabled ? "idle" : "idle";
    updateControls();
  }

  function floatToPcm64(float32) {
    var bytes = new Uint8Array(float32.length * 2), view = new DataView(bytes.buffer);
    for (var i = 0; i < float32.length; i++) {
      var sample = Math.max(-1, Math.min(1, float32[i]));
      view.setInt16(i * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
    }
    var out = "", chunk = 0x8000;
    for (var p = 0; p < bytes.length; p += chunk) out += String.fromCharCode.apply(null, bytes.subarray(p, p + chunk));
    return btoa(out);
  }

  function b64bytes(value) {
    var raw = atob(value), out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function playPcm(bytes) {
    if (!live.output || !bytes.length) return;
    var count = Math.floor(bytes.length / 2), buffer = live.output.createBuffer(1, count, 24000), data = buffer.getChannelData(0), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (var i = 0; i < count; i++) data[i] = view.getInt16(i * 2, true) / 32768;
    var src = live.output.createBufferSource(); src.buffer = buffer; src.connect(live.output.destination);
    var at = Math.max(live.output.currentTime + 0.02, live.nextTime || 0); live.nextTime = at + buffer.duration;
    duck(); live.playback.push(src); live.status = "playing"; setStatus(); src.start(at);
    src.onended = function () {
      live.playback = live.playback.filter(function (x) { return x !== src; });
      if (!live.playback.length) { restoreVolume(); if (live.enabled) { live.status = "listening"; setStatus(); } }
    };
  }

  function downsample(input, fromRate) {
    if (!fromRate || fromRate === 16000) return input;
    var ratio = fromRate / 16000, len = Math.max(1, Math.floor(input.length / ratio)), out = new Float32Array(len);
    for (var i = 0; i < len; i++) {
      var a = Math.floor(i * ratio), b = Math.min(input.length, Math.floor((i + 1) * ratio)), sum = 0, n = 0;
      while (a < b) { sum += input[a++]; n++; }
      out[i] = n ? sum / n : 0;
    }
    return out;
  }

  function activeSource() {
    var best = null, bestLevel = 0;
    live.analysers.forEach(function (item) {
      item.node.getByteTimeDomainData(item.data);
      var sum = 0;
      for (var i = 0; i < item.data.length; i++) { var d = (item.data[i] - 128) / 128; sum += d * d; }
      var level = Math.sqrt(sum / item.data.length);
      if (level > bestLevel) { bestLevel = level; best = item.source; }
    });
    return bestLevel > 0.01 && best ? { label: best.label, type: best.type } : live.speaker;
  }

  function mergeText(current, incoming) {
    incoming = text(incoming).trim(); if (!incoming) return current;
    if (!current) return incoming;
    if (incoming.indexOf(current) === 0) return incoming;
    if (current.indexOf(incoming) !== -1) return current;
    return (current + " " + incoming).replace(/\s+/g, " ").trim();
  }

  function finalizeTurn() {
    if (!live.sourceText && !live.translatedText) return;
    var who = live.speaker || activeSource() || { label: "Remote participant", type: "participant" };
    live.history.push({ speaker: who.label, type: who.type, source: live.sourceText, translated: live.translatedText, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
    if (live.history.length > MAX_HISTORY) live.history = live.history.slice(-MAX_HISTORY);
    live.sourceText = live.translatedText = ""; live.speaker = null;
    renderTranscript();
  }

  function scheduleFinalize() {
    if (live.finalizeTimer) clearTimeout(live.finalizeTimer);
    live.finalizeTimer = setTimeout(function () { live.finalizeTimer = null; finalizeTurn(); }, 1400);
  }

  function renderTranscript() {
    var host = byId("orbit-transcript"); if (!host) return;
    var entries = live.history.slice();
    if (live.sourceText || live.translatedText) {
      var who = live.speaker || activeSource() || { label: "Remote participant", type: "participant" };
      entries.push({ speaker: who.label, type: who.type, source: live.sourceText, translated: live.translatedText, time: "now" });
    }
    if (!entries.length) { host.innerHTML = '<div class="empty">Incoming participant and shared-screen audio will appear here once Live Translation is started.</div>'; return; }
    host.innerHTML = entries.map(function (x) {
      return '<div class="entry"><div class="meta"><span class="speaker">' + esc(x.speaker) + '</span><span class="badge">' + esc(x.type) + ' · ' + esc(x.time) + '</span></div>' +
        '<div class="cap">Original</div><div class="original">' + esc(x.source || "…") + '</div>' +
        '<div class="cap">Translation</div><div class="translated">' + esc(x.translated || "…") + '</div></div>';
    }).join("");
    host.scrollTop = host.scrollHeight;
  }

  function startInput(mediaSources, generation) {
    if (!live.input || !live.socket || generation !== live.generation) return;
    disconnectInput();
    try {
      var mixer = live.input.createGain(); mixer.gain.value = 1 / Math.max(1, Math.sqrt(mediaSources.length));
      mediaSources.forEach(function (remote) {
        var source = live.input.createMediaStreamSource(new MediaStream([remote.mediaTrack]));
        var analyser = live.input.createAnalyser(); analyser.fftSize = 256; source.connect(analyser); analyser.connect(mixer);
        live.sources.push(source); live.analysers.push({ node: analyser, data: new Uint8Array(analyser.fftSize), source: remote });
      });
      var processor = live.input.createScriptProcessor(1024, 1, 1);
      processor.onaudioprocess = function (event) {
        event.outputBuffer.getChannelData(0).fill(0);
        var ws = live.socket;
        if (generation !== live.generation || !live.enabled || !ws || ws.readyState !== 1 || ws.bufferedAmount > 512 * 1024) return;
        live.speaker = activeSource() || live.speaker;
        var pcm = downsample(event.inputBuffer.getChannelData(0), live.input.sampleRate);
        ws.send(JSON.stringify({ realtimeInput: { audio: { data: floatToPcm64(pcm), mimeType: "audio/pcm;rate=16000" } } }));
      };
      mixer.connect(processor); processor.connect(live.input.destination);
      live.mixer = mixer; live.processor = processor;
    } catch (_) { showError("This browser cannot capture incoming meeting audio."); }
  }

  function reconnect(generation) {
    if (generation !== live.generation || !live.enabled || live.reconnectTimer) return;
    live.reconnects += 1;
    if (live.reconnects > 2) {
      live.reconnectTimer = setTimeout(function () { live.reconnectTimer = null; if (live.enabled) { stopTranslation(true); syncTranslation(); } }, 700);
      return;
    }
    live.status = "connecting"; setStatus();
    live.reconnectTimer = setTimeout(function () {
      live.reconnectTimer = null;
      if (generation === live.generation && live.enabled) openSocket(live.mediaSources, generation, live.sessionHandle);
    }, 350 * live.reconnects);
  }

  function openSocket(mediaSources, generation, resumeHandle) {
    disconnectInput();
    var ws;
    try { ws = new WebSocket(LIVE_URL + "?access_token=" + encodeURIComponent(live.token)); } catch (_) { reconnect(generation); return; }
    live.socket = ws;
    ws.onopen = function () {
      if (generation !== live.generation || live.socket !== ws || !live.enabled) return;
      ws.send(JSON.stringify({ setup: {
        model: live.model.indexOf("models/") === 0 ? live.model : "models/" + live.model,
        generationConfig: { responseModalities: ["AUDIO"], inputAudioTranscription: {}, outputAudioTranscription: {}, translationConfig: { targetLanguageCode: ui.target, echoTargetLanguage: false } },
        sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
        contextWindowCompression: { slidingWindow: {} }
      } }));
    };
    ws.onmessage = function (event) {
      if (generation !== live.generation || !live.enabled) return;
      var msg; try { msg = JSON.parse(event.data); } catch (_) { return; }
      if (msg.sessionResumptionUpdate && msg.sessionResumptionUpdate.resumable && msg.sessionResumptionUpdate.newHandle) live.sessionHandle = msg.sessionResumptionUpdate.newHandle;
      if (msg.setupComplete) { live.reconnects = 0; live.status = "listening"; setStatus(); startInput(mediaSources, generation); return; }
      var c = msg.serverContent; if (!c) return;
      if (c.interrupted) stopPlayback();
      if (c.inputTranscription && c.inputTranscription.text) { live.speaker = live.speaker || activeSource(); live.sourceText = mergeText(live.sourceText, c.inputTranscription.text); scheduleFinalize(); renderTranscript(); }
      if (c.outputTranscription && c.outputTranscription.text) { live.speaker = live.speaker || activeSource(); live.translatedText = mergeText(live.translatedText, c.outputTranscription.text); scheduleFinalize(); renderTranscript(); }
      var parts = c.modelTurn && c.modelTurn.parts || [];
      parts.forEach(function (part) { if (part && part.inlineData && part.inlineData.data && /^audio\//.test(part.inlineData.mimeType || "")) playPcm(b64bytes(part.inlineData.data)); });
      if (c.turnComplete) { if (live.finalizeTimer) clearTimeout(live.finalizeTimer); live.finalizeTimer = null; finalizeTurn(); live.status = "listening"; setStatus(); }
    };
    ws.onerror = function () { if (generation === live.generation && live.enabled) { live.status = "connecting"; setStatus(); } };
    ws.onclose = function () { if (generation === live.generation && live.socket === ws && live.enabled) { live.socket = null; disconnectInput(); reconnect(generation); } };
  }

  function startTranslation(remote) {
    var generation = ++live.generation;
    live.signature = remote.signature + "|" + ui.target;
    live.mediaSources = remote.sources.slice(); live.status = "connecting"; live.reconnects = 0; live.sessionHandle = "";
    setStatus(); showError("");
    try { ensureAudio(); } catch (_) { showError("This browser cannot start live audio translation."); return; }
    fetch("/api/translate-token", { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ targetLanguageCode: ui.target }) })
      .then(function (r) { return r.json().then(function (p) { return { ok: r.ok, p: p || {} }; }); })
      .then(function (x) {
        if (generation !== live.generation || !live.enabled) return;
        if (!x.ok || !x.p.token || !x.p.model) { showError(x.p.error || "Translation could not start."); return; }
        live.token = x.p.token; live.model = x.p.model; openSocket(remote.sources, generation, "");
      })
      .catch(function () { if (generation === live.generation && live.enabled) showError("Translation could not start. Check the translator service configuration."); });
  }

  function syncTranslation() {
    if (!live.enabled) return;
    var remote = translatableMedia();
    if (!remote) { if (live.signature) stopTranslation(true); live.enabled = true; live.status = "idle"; updateControls(); return; }
    var sig = remote.signature + "|" + ui.target;
    if (sig === live.signature && (live.socket || live.reconnectTimer)) return;
    stopTranslation(true); live.enabled = true; startTranslation(remote);
  }

  function requestStart() {
    showError(""); live.enabled = true;
    try { ensureAudio(); } catch (_) { showError("This browser cannot start live audio translation."); live.enabled = false; return; }
    updateControls(); syncTranslation();
  }

  function showDonate() {
    injectStyles(); var old = byId("orbit-donate-dialog"); if (old) { old.remove(); return; }
    var node = document.createElement("div"); node.id = "orbit-donate-dialog";
    node.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center"><strong>Support Orbit</strong><button id="orbit-donate-close">×</button></div><p style="color:#c9c9ce;font-size:13px">Choose an amount. Stripe is used only when it is configured on the server.</p><div style="display:flex;gap:8px;flex-wrap:wrap">' + [10,25,50,100].map(function (n) { return '<button data-amount="' + n + '">$' + n + '</button>'; }).join("") + '</div><div id="orbit-donate-msg" style="margin-top:12px;font-size:13px"></div>';
    document.body.appendChild(node); byId("orbit-donate-close").onclick = function () { node.remove(); };
    node.querySelectorAll("[data-amount]").forEach(function (button) { button.onclick = function () {
      var amount = Number(button.getAttribute("data-amount")), msg = byId("orbit-donate-msg"); msg.textContent = "Preparing…";
      fetch("/api/donate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount: amount, returnPath: location.pathname }) })
        .then(function (r) { return r.json(); }).then(function (p) { if (p.url) location.href = p.url; else msg.textContent = p.mode === "demo" ? "Donation demo prepared. No payment was taken." : (p.error || "Could not start checkout."); })
        .catch(function () { msg.textContent = "Could not start checkout."; });
    }; });
  }

  function handleToolbar(key) {
    if (key !== TRANSLATOR_ID && key !== DONATE_ID) return;
    var now = Date.now();
    if (lastAction.key === key && now - lastAction.time < 500) return;
    lastAction = { key: key, time: now };
    if (key === TRANSLATOR_ID) toggleTranslator();
    if (key === DONATE_ID) showDonate();
  }

  function wrapApi() {
    var a = api(); if (!a || typeof a.notifyToolbarButtonClicked !== "function" || a.notifyToolbarButtonClicked.orbitWrapped) return;
    var original = a.notifyToolbarButtonClicked;
    function wrapped(value) {
      var key = typeof value === "string" ? value : value && (value.key || value.id || value.buttonKey || value.buttonId);
      try { handleToolbar(key); } catch (_) {}
      return original.apply(this, arguments);
    }
    wrapped.orbitWrapped = true; a.notifyToolbarButtonClicked = wrapped;
  }

  function clickFallback(event) {
    var node = event.target && event.target.closest && event.target.closest("button,[role='button']");
    if (!node || node.closest("#orbit-translator-panel") || node.closest("#orbit-donate-dialog")) return;
    var img = node.querySelector("img"), src = img && img.getAttribute("src") || "", label = (node.getAttribute("aria-label") || node.getAttribute("title") || node.textContent || "").trim().toLowerCase();
    if (src.indexOf("orbit-translator.svg") >= 0 || label === "translator") { event.preventDefault(); handleToolbar(TRANSLATOR_ID); }
    else if (src.indexOf("orbit-donate.svg") >= 0 || label === "donate") { event.preventDefault(); handleToolbar(DONATE_ID); }
  }

  function boot() {
    injectStyles(); document.addEventListener("click", clickFallback, true);
    setInterval(function () { wrapApi(); if (live.enabled) syncTranslation(); }, POLL_MS);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
