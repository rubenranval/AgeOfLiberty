// ═══════════════════════════════════════════════════════════════════════════
// AGE OF LIBERTY — INTRO: THE ENGINE AWAKENS
// Cyan wireframe SFL badge, pulsing to the rhythm of its own words.
// Gold flare on commit — the first human act warms the machine.
// ═══════════════════════════════════════════════════════════════════════════

window.AgeOfLibertyIntro = {

    _raf: null, _renderer: null, _scene: null, _camera: null, _clock: null,
    _badge: null, _badgeGroup: null, _materials: [],
    _sprites: {}, _pulse: 0, _gold: false, _goldT: 0,
    _awake: false, _awakeT: 0, _bootFade: 0,
    _solidMats: [], _wireMats: [],
    _typeTimer: null, _typeEl: null, _typeFull: '', _typeIdx: 0,

    // ─── Soft radial sprite (same technique as era-chest glow) ────────────
    _makeGlowTexture: function (size, color) {
        var c = document.createElement('canvas');
        c.width = size; c.height = size;
        var x = c.getContext('2d');
        var g = x.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        g.addColorStop(0, color.replace('A', '0.55'));
        g.addColorStop(0.4, color.replace('A', '0.18'));
        g.addColorStop(1, color.replace('A', '0'));
        x.fillStyle = g;
        x.fillRect(0, 0, size, size);
        var tex = new THREE.CanvasTexture(c);
        tex.needsUpdate = true;
        return tex;
    },

    _makeSprite: function (color, scale, z) {
        var mat = new THREE.SpriteMaterial({
            map: this._makeGlowTexture(256, color),
            transparent: true, opacity: 0,
            blending: THREE.AdditiveBlending, depthWrite: false
        });
        var s = new THREE.Sprite(mat);
        s.scale.set(scale, scale, 1);
        s.position.set(0, this._spriteY, z);
        this._scene.add(s);
        return s;
    },

    init: function (canvasId, mini) {
        this.destroy();
        var canvas = document.getElementById(canvasId);
        if (!canvas || typeof THREE === 'undefined') return;

        this._mini = !!mini;
        var W = this._mini ? (canvas.clientWidth || 64) : window.innerWidth;
        var H = this._mini ? (canvas.clientHeight || 64) : window.innerHeight;
        this._renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
        this._renderer.setSize(W, H);
        this._renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

        this._scene = new THREE.Scene();
        this._camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
        this._camera.position.set(0, this._mini ? 0 : 0.15, this._mini ? 3.0 : 4);
        this._camera.lookAt(0, 0, 0);
        this._clock = new THREE.Clock();

        // Glow layers — cyan pair live, gold pair waiting
        this._spriteY = this._mini ? 0 : 0.45;
        this._sprites.cyanCore = this._makeSprite('rgba(74,216,255,A)', 1.3, -0.15);
        this._sprites.cyanHalo = this._makeSprite('rgba(60,180,240,A)', 2.6, -0.3);
        this._sprites.goldCore = this._makeSprite('rgba(240,200,96,A)', 1.3, -0.14);
        this._sprites.goldHalo = this._makeSprite('rgba(220,165,40,A)', 2.6, -0.29);
        this._sprites.white = this._makeSprite('rgba(240,246,255,A)', 1.5, -0.1);

        // Badge — wireframe conversion
        var self = this;
        if (this._mini) { this._awake = true; this._awakeT = 1; this._bootFade = 1; }

        var loader = new THREE.GLTFLoader();
        loader.load('assets/3D/sfl-badge.glb', function (gltf) {
            var model = gltf.scene;
            // Center via bounding box
            var box = new THREE.Box3().setFromObject(model);
            var center = box.getCenter(new THREE.Vector3());
            model.position.sub(center);

            // Dual skin: solid white for boot, wireframe overlay for the awakening
            self._solidMats = []; self._wireMats = [];
            var wires = [];
            model.traverse(function (node) {
                if (node.isMesh) {
                    node.material = new THREE.MeshBasicMaterial({
                        color: 0xffffff, transparent: true, opacity: 0
                    });
                    self._solidMats.push(node.material);
                    var wire = new THREE.Mesh(node.geometry, new THREE.MeshBasicMaterial({
                        color: 0x4ad8ff, wireframe: true, transparent: true, opacity: 0
                    }));
                    self._wireMats.push(wire.material);
                    wires.push({ parent: node, mesh: wire });
                }
            });
            for (var w = 0; w < wires.length; w++) wires[w].parent.add(wires[w].mesh);

            self._badgeGroup = new THREE.Group();
            self._badgeGroup.add(model);
            self._badgeGroup.position.y = self._mini ? 0 : 0.45;
            self._badgeGroup.scale.set(0.2, 0.2, 0.2);
            self._badge = model;
            self._scene.add(self._badgeGroup);
        }, undefined, function (e) { console.warn('Intro badge load error:', e); });

        // Render loop
        var cyan = new THREE.Color(0x4ad8ff), gold = new THREE.Color(0xf0c860);
        function loop() {
            self._raf = requestAnimationFrame(loop);
            var dt = self._clock.getDelta();
            var t = self._clock.getElapsedTime();

            // Pulse decay (typewriter drives it up)
            self._pulse *= Math.exp(-3.2 * dt);
            var breathe = 0.06 * Math.sin(t * 1.4);
            var energy = Math.min(1, self._pulse) + breathe;

            // Gold transition
            if (self._gold && self._goldT < 1) self._goldT = Math.min(1, self._goldT + dt / 0.8);
            var g = self._goldT;

            // Boot fade-in (solid white appears), then awaken crossfade
            self._bootFade = Math.min(1, self._bootFade + dt / 0.8);
            if (self._awake && self._awakeT < 1) self._awakeT = Math.min(1, self._awakeT + dt / 2.0);
            var a = self._awakeT;
            var aEase = a * a * (3 - 2 * a);

            if (self._badgeGroup) {
                // Slight grow on awakening: 0.20 → 0.26
                var sBase = self._mini ? 0.42 : (0.20 + 0.06 * aEase);
                var s = sBase * (1 + energy * 0.05 * a + g * 0.12);
                self._badgeGroup.scale.set(s, s, s);
                self._badgeGroup.rotation.y += dt * aEase * (0.4 + energy * 0.25 + g * 1.2);
                self._badgeGroup.rotation.x = Math.sin(t * 0.5) * 0.08 * aEase;
            }

            // Solid white fades out as wireframe fades in
            var i;
            for (i = 0; i < self._solidMats.length; i++) {
                self._solidMats[i].opacity = self._bootFade * (1 - aEase);
            }
            for (i = 0; i < self._wireMats.length; i++) {
                self._wireMats[i].opacity = aEase * (0.42 + energy * 0.35 + g * 0.15);
                self._wireMats[i].color.copy(cyan).lerp(gold, g);
            }

            // Glow crossfade + pulse (all gated behind the awakening)
            var coreBase = (0.5 + energy * 0.45) * aEase;
            var haloBase = (0.3 + energy * 0.25) * aEase;
            self._sprites.white.material.opacity = self._bootFade * (1 - aEase) * 0.12;
            self._sprites.cyanCore.material.opacity = coreBase * (1 - g);
            self._sprites.cyanHalo.material.opacity = haloBase * (1 - g);
            self._sprites.goldCore.material.opacity = coreBase * g * 1.2;
            self._sprites.goldHalo.material.opacity = haloBase * g * 1.2;
            var gs = (1 + energy * 0.14 + g * 0.3) * (self._mini ? 0.6 : 1);
            self._sprites.cyanCore.scale.set(1.3 * gs, 1.3 * gs, 1);
            self._sprites.cyanHalo.scale.set(2.6 * gs, 2.6 * gs, 1);
            self._sprites.goldCore.scale.set(1.3 * gs, 1.3 * gs, 1);
            self._sprites.goldHalo.scale.set(2.6 * gs, 2.6 * gs, 1);

            self._renderer.render(self._scene, self._camera);
        }
        loop();
    },

    initMini: function (canvasId) { this.init(canvasId, true); },

    // ─── Awakening: white → wireframe, stillness → rotation ────────────────
    awaken: function () { this._awake = true; },

    // ─── Typewriter: the engine speaks, the badge pulses ──────────────────
    typeText: function (elId, text) {
        this._clearType();
        var el = document.getElementById(elId);
        if (!el) return;
        this._typeEl = el; this._typeFull = text; this._typeIdx = 0;
        el.textContent = '';
        var self = this;
        this._typeTimer = setInterval(function () {
            if (self._typeIdx >= self._typeFull.length) { self._clearType(); return; }
            self._typeIdx++;
            self._typeEl.textContent = self._typeFull.substring(0, self._typeIdx);
            var ch = self._typeFull[self._typeIdx - 1];
            // Voice pulse: letters push, punctuation breathes
            if (ch !== ' ') self._pulse = Math.min(1.4, self._pulse + 0.16);
            if (window.AgeOfLibertyAudio && window.AgeOfLibertyAudio.sfxType && self._typeIdx % 3 === 0) {
                try { window.AgeOfLibertyAudio.sfxType(); } catch (e) {}
            }
        }, 26);
    },

    // Returns true if a line was mid-type (and is now completed instantly)
    finishType: function () {
        if (this._typeTimer && this._typeEl) {
            this._typeEl.textContent = this._typeFull;
            this._clearType();
            this._pulse = 1.0;
            return true;
        }
        return false;
    },

    _clearType: function () {
        if (this._typeTimer) { clearInterval(this._typeTimer); this._typeTimer = null; }
    },

    // ─── Commit: history begins ────────────────────────────────────────────
    flareGold: function () {
        this._gold = true;
        this._pulse = 1.4;
        try {
            if (window.AgeOfLibertyAmbient) window.AgeOfLibertyAmbient.emit('gold', 30);
        } catch (e) {}
    },

    destroy: function () {
        this._clearType();
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = null;
        if (this._renderer) { try { this._renderer.dispose(); } catch (e) {} }
        this._renderer = null; this._scene = null; this._camera = null;
        this._badge = null; this._badgeGroup = null;
        this._solidMats = []; this._wireMats = []; this._sprites = {};
        this._pulse = 0; this._gold = false; this._goldT = 0;
        this._awake = false; this._awakeT = 0; this._bootFade = 0; this._mini = false;
    }
};