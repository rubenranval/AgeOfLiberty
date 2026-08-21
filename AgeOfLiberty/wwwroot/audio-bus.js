// ═══════════════════════════════════════════════════════════════════════════
// AUDIO BUS — restores volume control on iOS.
//
// WHY: iOS WebKit ignores HTMLMediaElement.volume entirely. Setting
// audio.volume = 0.5 silently does nothing — volume is hardware-only. This is
// a longstanding WebKit restriction, not a bug in our code, which is why the
// sliders work on Android and not on iPhone.
//
// HOW: route every <audio> element through a Web Audio GainNode, then redefine
// the element's own `volume` property so it writes to that gain instead. All
// existing code (el.volume = x, fades, per-voice levels) keeps working
// unchanged — it just now goes somewhere that iOS respects.
//
// LOAD ORDER: after three/blazor scripts, BEFORE animations.js, intro-music.js,
// character-voice.js — it patches window.Audio, so it must be in place before
// any Audio object is constructed.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
    var NativeAudio = window.Audio;

    var Bus = window.AoLAudioBus = {
        _ctx: null,
        _music: null,      // music bus gain
        _sfx: null,        // sfx bus gain
        _musicVol: 0.4,
        _sfxVol: 0.6,
        _attached: new WeakMap(),
        _pendingResume: false,

        ctx: function () {
            if (this._ctx) return this._ctx;
            var AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            try {
                this._ctx = new AC();
                this._music = this._ctx.createGain();
                this._sfx = this._ctx.createGain();
                this._music.gain.value = this._musicVol;
                this._sfx.gain.value = this._sfxVol;
                this._music.connect(this._ctx.destination);
                this._sfx.connect(this._ctx.destination);
                this._armResume();
            } catch (e) {
                this._ctx = null;
            }
            return this._ctx;
        },

        // iOS starts every AudioContext suspended until a user gesture.
        _armResume: function () {
            if (this._pendingResume) return;
            this._pendingResume = true;
            var self = this;
            var wake = function () {
                if (self._ctx && self._ctx.state === 'suspended') {
                    self._ctx.resume().catch(function () {});
                }
            };
            ['touchstart', 'touchend', 'pointerdown', 'click', 'keydown'].forEach(function (ev) {
                document.addEventListener(ev, wake, { passive: true });
            });
        },

        /**
         * Route an audio element through a gain node and hijack its `volume`
         * property. bus is 'music' or 'sfx' (default 'sfx').
         */
        attach: function (el, bus) {
            if (!el || this._attached.has(el)) return el;
            var ctx = this.ctx();
            if (!ctx) return el;                 // no Web Audio: leave as-is

            var target = (bus === 'music') ? this._music : this._sfx;
            var gain;
            try {
                var srcNode = ctx.createMediaElementSource(el);
                gain = ctx.createGain();
                gain.gain.value = (typeof el.volume === 'number') ? el.volume : 1;
                srcNode.connect(gain);
                gain.connect(target);
            } catch (e) {
                return el;                        // already connected elsewhere
            }

            this._attached.set(el, gain);

            // Redefine `volume` so existing code transparently drives the gain.
            var stored = gain.gain.value;
            try {
                Object.defineProperty(el, 'volume', {
                    configurable: true,
                    get: function () { return stored; },
                    set: function (v) {
                        v = Math.max(0, Math.min(1, Number(v) || 0));
                        stored = v;
                        try { gain.gain.value = v; } catch (e) {}
                    }
                });
            } catch (e) {}

            this._armResume();
            return el;
        },

        setMusicVolume: function (v) {
            this._musicVol = Math.max(0, Math.min(1, Number(v) || 0));
            if (this._music) { try { this._music.gain.value = this._musicVol; } catch (e) {} }
        },
        setSfxVolume: function (v) {
            this._sfxVol = Math.max(0, Math.min(1, Number(v) || 0));
            if (this._sfx) { try { this._sfx.gain.value = this._sfxVol; } catch (e) {} }
        },
        getMusicVolume: function () { return this._musicVol; },
        getSfxVolume: function () { return this._sfxVol; }
    };

    // ─── Patch window.Audio so every element is routed automatically ───
    // Elements created before a bus is known default to sfx; intro-music
    // re-attaches its own element to the music bus explicitly.
    function busFor(src) {
        if (!src) return 'sfx';
        var s = String(src).toLowerCase();
        // anything under a music/ folder, or named *music*/*theme*/*ambient*
        if (s.indexOf('music') !== -1 || s.indexOf('theme') !== -1 || s.indexOf('ambient') !== -1) return 'music';
        return 'sfx';
    }

    function PatchedAudio(src) {
        var el = src === undefined ? new NativeAudio() : new NativeAudio(src);
        try { Bus.attach(el, busFor(src)); } catch (e) {}
        return el;
    }
    PatchedAudio.prototype = NativeAudio.prototype;
    window.Audio = PatchedAudio;

    // ─── Bridge to the existing AgeOfLibertyAudio API ───
    // Wraps whatever animations.js defines, so the Settings sliders drive the
    // gain buses as well as the original implementation.
    function bridge() {
        var A = window.AgeOfLibertyAudio = window.AgeOfLibertyAudio || {};

        var origSetMusic = A.setMusicVolume;
        A.setMusicVolume = function (v) {
            Bus.setMusicVolume(v);
            try { if (origSetMusic) origSetMusic.call(A, v); } catch (e) {}
        };

        var origSetSfx = A.setSfxVolume;
        A.setSfxVolume = function (v) {
            Bus.setSfxVolume(v);
            try { if (origSetSfx) origSetSfx.call(A, v); } catch (e) {}
        };

        if (!A.getMusicVolume) A.getMusicVolume = function () { return Bus.getMusicVolume(); };
        if (!A.getSfxVolume) A.getSfxVolume = function () { return Bus.getSfxVolume(); };
    }

    // Elements created empty then given a src later still get the right bus.
    Bus.reroute = function (el) {
        if (!el) return;
        var gain = this._attached.get(el);
        if (!gain || !this._ctx) return;
        try {
            gain.disconnect();
            gain.connect(busFor(el.currentSrc || el.src) === 'music' ? this._music : this._sfx);
        } catch (e) {}
    };

    bridge();
    // animations.js may load after this file and overwrite the object; re-bridge
    // once everything has loaded so our wrappers sit on top.
    window.addEventListener('load', bridge);
})();