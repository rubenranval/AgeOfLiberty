// ═══════════════════════════════════════════════════════════════════════════
// AGE OF LIBERTY — AMBIENT: THE SIMULATION FLOOR
// Layer 1: flat top-down grid, slowly drifting, breathing.
// Layer 2: rising motes — cyan machine-dust, rare gold history-sparks.
// Layer 3: light streaks — a trace crossing the grid every ~8-10s.
// Overrides AgeOfLiberty.initParticles (load after animations.js).
// ═══════════════════════════════════════════════════════════════════════════

(function () {

    var _raf = null, _canvas = null, _ctx = null;
    var _particles = [], _streaks = [], _emits = [];
    var _sprites = {};
    var _W = 0, _H = 0;
    var _nextStreak = 0;
    var _resizeTimer = null;

    function makeSprite(size, r, g, b) {
        var c = document.createElement('canvas');
        c.width = size; c.height = size;
        var x = c.getContext('2d');
        var grad = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',1)');
        grad.addColorStop(0.25, 'rgba(' + r + ',' + g + ',' + b + ',0.5)');
        grad.addColorStop(0.6, 'rgba(' + r + ',' + g + ',' + b + ',0.12)');
        grad.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
        x.fillStyle = grad;
        x.fillRect(0, 0, size, size);
        return c;
    }

    function spawnParticle(initial) {
        var roll = Math.random();
        var layer = roll < 0.55 ? 'far' : roll < 0.92 ? 'mid' : 'near';
        var p = {
            layer: layer,
            x: Math.random() * _W,
            y: initial ? Math.random() * _H : _H + 20,
            phase: Math.random() * Math.PI * 2,
            phase2: Math.random() * Math.PI * 2,
            twinklePhase: Math.random() * Math.PI * 2,
            twinkleSpeed: 0.4 + Math.random() * 0.8,
            flareAt: 4 + Math.random() * 18,
            flare: 0
        };
        if (layer === 'far') {
            p.sprite = Math.random() < 0.6 ? _sprites.cyan : _sprites.ice;
            p.size = 2.5 + Math.random() * 3;
            p.speedY = 4 + Math.random() * 6;
            p.driftAmp = 6 + Math.random() * 10;
            p.driftFreq = 0.15 + Math.random() * 0.2;
            p.baseAlpha = 0.14 + Math.random() * 0.14;
        } else if (layer === 'mid') {
            p.sprite = Math.random() < 0.75 ? _sprites.cyan : _sprites.gold;
            p.size = 4 + Math.random() * 5;
            p.speedY = 8 + Math.random() * 10;
            p.driftAmp = 10 + Math.random() * 18;
            p.driftFreq = 0.2 + Math.random() * 0.3;
            p.baseAlpha = 0.18 + Math.random() * 0.2;
        } else {
            p.sprite = Math.random() < 0.5 ? _sprites.gold : _sprites.iceBig;
            p.size = 10 + Math.random() * 14;
            p.speedY = 12 + Math.random() * 12;
            p.driftAmp = 16 + Math.random() * 24;
            p.driftFreq = 0.12 + Math.random() * 0.18;
            p.baseAlpha = 0.10 + Math.random() * 0.10;
        }
        return p;
    }

    function spawnStreak() {
        var gold = Math.random() < 0.18;
        var ltr = Math.random() < 0.5;
        return {
            y: 60 + Math.random() * (_H - 160),
            x: ltr ? -220 : _W + 220,
            dir: ltr ? 1 : -1,
            speed: (_W + 440) / (0.9 + Math.random() * 0.5), // px/s → crosses in ~1s
            len: 140 + Math.random() * 120,
            color: gold ? '240,190,90' : '90,220,255',
            alpha: gold ? 0.5 : 0.55
        };
    }

    function drawStreaks(dt) {
        for (var i = _streaks.length - 1; i >= 0; i--) {
            var s = _streaks[i];
            s.x += s.dir * s.speed * dt;
            if ((s.dir === 1 && s.x - s.len > _W + 40) || (s.dir === -1 && s.x + s.len < -40)) {
                _streaks.splice(i, 1);
                continue;
            }
            var tail = s.x - s.dir * s.len;
            var grad = _ctx.createLinearGradient(tail, s.y, s.x, s.y);
            grad.addColorStop(0, 'rgba(' + s.color + ',0)');
            grad.addColorStop(0.75, 'rgba(' + s.color + ',' + (s.alpha * 0.5) + ')');
            grad.addColorStop(1, 'rgba(' + s.color + ',' + s.alpha + ')');
            _ctx.strokeStyle = grad;
            _ctx.lineWidth = 1.5;
            _ctx.beginPath();
            _ctx.moveTo(tail, s.y); _ctx.lineTo(s.x, s.y);
            _ctx.stroke();
            // Bright head
            _ctx.fillStyle = 'rgba(' + s.color + ',' + s.alpha + ')';
            _ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
        }
    }

    function init(canvasId) {
        destroy();
        _canvas = document.getElementById(canvasId);
        if (!_canvas) return;
        _ctx = _canvas.getContext('2d');

        _W = window.innerWidth;
        _H = window.innerHeight;
        var perf = window.AoLPerformance || {};
        var dpr = Math.min(window.devicePixelRatio || 1, perf.pixelRatioCap || 1.75);
        _canvas.width = _W * dpr;
        _canvas.height = _H * dpr;
        _ctx.scale(dpr, dpr);

        _sprites.cyan = makeSprite(64, 100, 210, 250);
        _sprites.ice = makeSprite(64, 160, 200, 240);
        _sprites.gold = makeSprite(64, 235, 190, 100);
        _sprites.iceBig = makeSprite(96, 140, 200, 250);

        var particleCap = perf.reducedMotion ? 24 : (perf.lowPower ? 55 : 90);
        var count = Math.min(particleCap, Math.floor(_W * _H / (perf.lowPower ? 15000 : 10500)));
        _particles = [];
        for (var i = 0; i < count; i++) _particles.push(spawnParticle(true));
        _streaks = []; _emits = [];
        _nextStreak = 2 + Math.random() * 4;

        var last = performance.now();
        var frameInterval = perf.frameIntervalMs || 16;
        var _watchdog = 0;

        function loop(now) {
            _raf = requestAnimationFrame(loop);
            if (now - last < frameInterval) return;
            var dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            var t = now / 1000;

            _watchdog += dt;
            if (_watchdog > 2) {
                _watchdog = 0;
                if (Math.abs(window.innerWidth - _W) > 2 || Math.abs(window.innerHeight - _H) > 2 || !_canvas.isConnected) {
                    var id = _canvas.id;
                    init(id);
                    return;
                }
            }

            _ctx.clearRect(0, 0, _W, _H);

            // Layer 3 — streaks (under motes, over grid)
            _nextStreak -= dt;
            if (_nextStreak <= 0) {
                _streaks.push(spawnStreak());
                _nextStreak = 7 + Math.random() * 4;
            }
            drawStreaks(dt);

            // Layer 2 — motes, additive
            _ctx.globalCompositeOperation = 'lighter';
            for (var i = 0; i < _particles.length; i++) {
                var p = _particles[i];

                // Flare: brief bright acceleration — a data packet waking up
                var flareBoost = 1, flareAlpha = 1;
                if (p.flare > 0) {
                    p.flare -= dt;
                    var ft = Math.max(0, p.flare / 0.6);
                    flareBoost = 1 + 0.9 * Math.sin(ft * Math.PI);
                    flareAlpha = 1 + 1.6 * Math.sin(ft * Math.PI);
                } else if (t > p.flareAt) {
                    p.flare = 0.6;
                    p.flareAt = t + 6 + Math.random() * 16;
                }

                p.y -= p.speedY * flareBoost * dt;
                // Two-octave wander — organic, non-mechanical drift
                var wobble = Math.sin(t * p.driftFreq * Math.PI * 2 + p.phase) * p.driftAmp
                    + Math.sin(t * p.driftFreq * 3.1 + p.phase2) * p.driftAmp * 0.35;
                if (p.y < -30) { _particles[i] = spawnParticle(false); continue; }
                var twinkle = 0.7 + 0.3 * Math.sin(t * p.twinkleSpeed * Math.PI * 2 + p.twinklePhase);
                _ctx.globalAlpha = Math.min(0.85, p.baseAlpha * twinkle * flareAlpha);
                var s = p.size * 2 * (p.flare > 0 ? 1.25 : 1);
                _ctx.drawImage(p.sprite, p.x + wobble - s / 2, p.y - s / 2, s, s);
            }

            // Game-reaction emissions — short-lived rising motes
            for (var e = _emits.length - 1; e >= 0; e--) {
                var m = _emits[e];
                m.life -= dt;
                if (m.life <= 0) { _emits.splice(e, 1); continue; }
                m.y -= m.speedY * dt;
                m.x += m.vx * dt;
                var lt = m.life / m.maxLife;
                _ctx.globalAlpha = Math.min(0.8, m.alpha * Math.sin(lt * Math.PI));
                var ms = m.size * 2;
                _ctx.drawImage(m.sprite, m.x - ms / 2, m.y - ms / 2, ms, ms);
            }

            _ctx.globalAlpha = 1;
            _ctx.globalCompositeOperation = 'source-over';
        }
        _raf = requestAnimationFrame(loop);

        window.addEventListener('resize', _onResize);
        document.addEventListener('visibilitychange', _onVis);
    }

    function _onVis() {
        if (document.hidden) {
            if (_raf) cancelAnimationFrame(_raf);
            _raf = null;
        } else if (_canvas) {
            init(_canvas.id);
        }
    }
    function _onResize() {
        if (_resizeTimer) clearTimeout(_resizeTimer);
        _resizeTimer = setTimeout(function () {
            _resizeTimer = null;
            if (_canvas) init(_canvas.id);
        }, 150);
    }

    function destroy() {
        if (_raf) cancelAnimationFrame(_raf);
        _raf = null;
        window.removeEventListener('resize', _onResize);
        document.removeEventListener('visibilitychange', _onVis);
        if (_resizeTimer) clearTimeout(_resizeTimer);
        _resizeTimer = null;
        _particles = []; _streaks = []; _emits = [];
    }

    function emit(kind, count, xNorm) {
        if (!_canvas || _emits.length > 90) return;
        var sprite = kind === 'gold' ? _sprites.gold : _sprites.cyan;
        var cx = (typeof xNorm === 'number' ? xNorm : 0.15 + Math.random() * 0.7) * _W;
        for (var i = 0; i < (count || 5); i++) {
            var maxLife = 1.6 + Math.random() * 1.4;
            _emits.push({
                sprite: sprite,
                x: cx + (Math.random() - 0.5) * 120,
                y: _H * (0.55 + Math.random() * 0.4),
                vx: (Math.random() - 0.5) * 26,
                speedY: 40 + Math.random() * 55,
                size: 3.5 + Math.random() * 4.5,
                alpha: 0.35 + Math.random() * 0.3,
                life: maxLife, maxLife: maxLife
            });
        }
    }

    window.AgeOfLiberty = window.AgeOfLiberty || {};
    window.AgeOfLiberty.initParticles = init;
    window.AgeOfLiberty.stopParticles = destroy;
    window.AgeOfLibertyAmbient = { init: init, destroy: destroy, emit: emit };

})();
