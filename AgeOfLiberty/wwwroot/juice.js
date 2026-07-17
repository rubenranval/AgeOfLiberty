// ═══════════════════════════════════════════════════════════════════════════
// AGE OF LIBERTY — JUICE EFFECTS MODULE
// Visual feedback: particles, celebrations, shake, floating text
// ═══════════════════════════════════════════════════════════════════════════

window.AgeOfLibertyJuice = {

    // Map-only: effects are muted on other tabs and during ceremonies
    _active: true,
    setActive: function (a) { this._active = !!a; },


    // ─── FLOATING TEXT ───────────────────────────────────────────────────
    floatText: function (text, x, y, color, parentId) {
        if (!window.AgeOfLibertyJuice._active) return;
        var container = document.getElementById(parentId);
        if (!container) container = document.body;

        var el = document.createElement('div');
        el.textContent = text;
        el.style.cssText = 'position:absolute;left:' + x + 'px;top:' + y + 'px;' +
            'color:' + (color || '#f0c860') + ';font-size:16px;font-weight:700;' +
            'font-family:"Rajdhani",sans-serif;letter-spacing:0.5px;pointer-events:none;z-index:4;' +
            'text-shadow:0 0 8px rgba(0,0,0,0.6);white-space:nowrap;' +
            'transform:translateX(-50%);';
        container.appendChild(el);

        var start = performance.now();
        function tick(now) {
            var t = (now - start) / 1000;
            if (t >= 1) { el.remove(); return; }
            el.style.top = (y - t * 60) + 'px';
            el.style.opacity = (1 - t * t).toString();
            el.style.transform = 'translateX(-50%) scale(' + (1 + t * 0.15) + ')';
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    },

    // ─── PARTICLE BURST ──────────────────────────────────────────────────
    particleBurst: function (x, y, count, color, parentId) {
        if (!window.AgeOfLibertyJuice._active) return;
        var container = document.getElementById(parentId);
        if (!container) container = document.body;
        count = count || 12;
        color = color || '#f0c860';

        for (var i = 0; i < count; i++) {
            var angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
            var speed = 40 + Math.random() * 60;
            var size = 3 + Math.random() * 5;
            var life = 500 + Math.random() * 400;

            var dot = document.createElement('div');
            dot.style.cssText = 'position:absolute;left:' + x + 'px;top:' + y + 'px;' +
                'width:' + size + 'px;height:' + size + 'px;border-radius:50%;' +
                'background:' + color + ';pointer-events:none;z-index:4;' +
                'box-shadow:0 0 ' + (size * 2) + 'px ' + color + ';' +
                'transform:translate(-50%,-50%);';
            container.appendChild(dot);

            (function (d, a, sp, lt) {
                var start = performance.now();
                var vx = Math.cos(a) * sp;
                var vy = Math.sin(a) * sp;
                function tick(now) {
                    var t = (now - start) / lt;
                    if (t >= 1) { d.remove(); return; }
                    var drag = 1 - t * 0.7;
                    d.style.left = (x + vx * t * drag) + 'px';
                    d.style.top = (y + vy * t * drag - t * 15) + 'px';
                    d.style.opacity = (1 - t * t).toString();
                    d.style.transform = 'translate(-50%,-50%) scale(' + (1 - t * 0.5) + ')';
                    requestAnimationFrame(tick);
                }
                requestAnimationFrame(tick);
            })(dot, angle, speed, life);
        }
    },

    // ─── RING PULSE ──────────────────────────────────────────────────────
    ringPulse: function (x, y, color, parentId) {
        if (!window.AgeOfLibertyJuice._active) return;
        var container = document.getElementById(parentId);
        if (!container) container = document.body;
        color = color || '#f0c860';

        var ring = document.createElement('div');
        ring.style.cssText = 'position:absolute;left:' + x + 'px;top:' + y + 'px;' +
            'width:0;height:0;border-radius:50%;' +
            'border:2.5px solid ' + color + ';pointer-events:none;z-index:4;' +
            'transform:translate(-50%,-50%);';
        container.appendChild(ring);

        var start = performance.now();
        function tick(now) {
            var t = (now - start) / 600;
            if (t >= 1) { ring.remove(); return; }
            var size = t * 90;
            ring.style.width = size + 'px';
            ring.style.height = size + 'px';
            ring.style.opacity = (1 - t).toString();
            ring.style.borderWidth = Math.max(0.5, 2.5 - t * 2) + 'px';
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    },

    // ─── SCREEN SHAKE ────────────────────────────────────────────────────
    shake: function (elementId, intensity, duration) {
        if (!window.AgeOfLibertyJuice._active) return;
        var el = document.getElementById(elementId);
        if (!el) return;
        intensity = intensity || 3;
        duration = duration || 300;
        var orig = el.style.transform || '';
        var start = performance.now();

        function tick(now) {
            var t = (now - start) / duration;
            if (t >= 1) { el.style.transform = orig; return; }
            var decay = 1 - t;
            var dx = (Math.random() - 0.5) * 2 * intensity * decay;
            var dy = (Math.random() - 0.5) * 2 * intensity * decay;
            el.style.transform = orig + ' translate(' + dx + 'px,' + dy + 'px)';
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    },

    // ─── NODE TAP ────────────────────────────────────────────────────────
    nodeTap: function (x, y, parentId) {
        if (!window.AgeOfLibertyJuice._active) return;
        this.ringPulse(x, y, 'rgba(74,216,255,0.5)', parentId);
    },

    // ─── BUILD CELEBRATION ───────────────────────────────────────────────
    buildCelebration: function (x, y, popGain, cost, parentId) {
        if (!window.AgeOfLibertyJuice._active) return;
        // Primary golden burst
        this.particleBurst(x, y, 14, '#f0c860', parentId);

        // Secondary sparkle burst
        var self = this;
        setTimeout(function () {
            self.particleBurst(x, y, 8, '#ffe9a8', parentId);
        }, 80);

        // Expanding ring
        this.ringPulse(x, y, '#d4a020', parentId);

        // White flash on the node
        var container = document.getElementById(parentId);
        if (container) {
            var flash = document.createElement('div');
            flash.style.cssText = 'position:absolute;left:' + x + 'px;top:' + y + 'px;' +
                'width:0;height:0;border-radius:50%;' +
                'background:rgba(190,235,255,0.5);pointer-events:none;z-index:3;' +
                'transform:translate(-50%,-50%);';
            container.appendChild(flash);

            var start = performance.now();
            function tick(now) {
                var t = (now - start) / 350;
                if (t >= 1) { flash.remove(); return; }
                var size = t < 0.3 ? (t / 0.3) * 70 : 70;
                flash.style.width = size + 'px';
                flash.style.height = size + 'px';
                flash.style.opacity = (t < 0.3 ? 0.6 : 0.6 * (1 - (t - 0.3) / 0.7)).toString();
                requestAnimationFrame(tick);
            }
            requestAnimationFrame(tick);
        }

        // Floating text
        if (popGain && popGain > 0) {
            this.floatText('+' + popGain + ' pop', x - 20, y - 45, '#8aa4c8', parentId);
        }
        this.floatText('-$' + cost, x + 25, y - 30, '#ff5648', parentId);

        // Gentle shake
        this.shake('graphArea', 2, 200);
    },

    // ─── CASCADE HIT ─────────────────────────────────────────────────────
    cascadeHit: function (x, y, priceChangePercent, parentId) {
        if (!window.AgeOfLibertyJuice._active) return;
        this.particleBurst(x, y, 10, '#ff5648', parentId);
        this.ringPulse(x, y, '#ff5648', parentId);
        this.shake('graphArea', 3, 250);

        if (priceChangePercent) {
            var sign = priceChangePercent > 0 ? '+' : '';
            this.floatText(sign + priceChangePercent + '%', x, y - 55, '#ff5648', parentId);
        }
    },

    // ─── TRAVELING PULSE ─────────────────────────────────────────────────
    // Energy visibly travels from one node to another along an edge
    travelingPulse: function (x1, y1, x2, y2, duration, color, parentId) {
        if (!window.AgeOfLibertyJuice._active) return;
        var container = document.getElementById(parentId);
        if (!container) container = document.body;
        duration = duration || 500;
        color = color || '#ff5648';

        var dot = document.createElement('div');
        dot.style.cssText = 'position:absolute;width:10px;height:10px;border-radius:50%;' +
            'background:' + color + ';pointer-events:none;z-index:4;' +
            'box-shadow:0 0 8px ' + color + ', 0 0 16px ' + color + ';' +
            'transform:translate(-50%,-50%);';
        container.appendChild(dot);

        // Trail dots
        var trails = [];
        for (var i = 0; i < 5; i++) {
            var trail = document.createElement('div');
            var ts = 6 - i;
            trail.style.cssText = 'position:absolute;width:' + ts + 'px;height:' + ts + 'px;' +
                'border-radius:50%;background:' + color + ';pointer-events:none;z-index:4;' +
                'opacity:' + (0.5 - i * 0.1) + ';transform:translate(-50%,-50%);';
            container.appendChild(trail);
            trails.push({ el: trail, delay: (i + 1) * 0.06 });
        }

        var start = performance.now();
        function tick(now) {
            var t = (now - start) / duration;
            if (t >= 1) {
                dot.remove();
                trails.forEach(function (tr) { tr.el.remove(); });
                return;
            }
            // Main dot
            dot.style.left = (x1 + (x2 - x1) * t) + 'px';
            dot.style.top = (y1 + (y2 - y1) * t) + 'px';
            dot.style.opacity = Math.sin(t * Math.PI).toString();

            // Trailing dots
            trails.forEach(function (tr) {
                var tt = Math.max(0, t - tr.delay);
                tr.el.style.left = (x1 + (x2 - x1) * tt) + 'px';
                tr.el.style.top = (y1 + (y2 - y1) * tt) + 'px';
            });

            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    },

    // ─── COIN DRIFT ──────────────────────────────────────────────────────
    coinDrift: function (startX, startY, targetId) {
        if (!window.AgeOfLibertyJuice._active) return;
        var target = document.getElementById(targetId);
        var endX, endY;
        if (target) {
            var rect = target.getBoundingClientRect();
            endX = rect.left + rect.width / 2;
            endY = rect.top + rect.height / 2;
        } else {
            endX = 60; endY = 30;
        }

        var coin = document.createElement('div');
        coin.textContent = '💰';
        coin.style.cssText = 'position:fixed;left:' + startX + 'px;top:' + startY + 'px;' +
            'font-size:12px;pointer-events:none;z-index:4;transform:translate(-50%,-50%);';
        document.body.appendChild(coin);

        var start = performance.now();
        var cpx = (startX + endX) / 2 + (Math.random() - 0.5) * 60;
        var cpy = Math.min(startY, endY) - 30 - Math.random() * 30;

        function tick(now) {
            var t = (now - start) / 700;
            if (t >= 1) { coin.remove(); return; }
            var u = 1 - t;
            coin.style.left = (u * u * startX + 2 * u * t * cpx + t * t * endX) + 'px';
            coin.style.top = (u * u * startY + 2 * u * t * cpy + t * t * endY) + 'px';
            coin.style.opacity = (t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25).toString();
            coin.style.transform = 'translate(-50%,-50%) scale(' + (1 - t * 0.4) + ')';
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    },

    // ─── INCOME TICK ─────────────────────────────────────────────────────
    incomeTick: function (builtNodes, hudGoldId) {
        if (!window.AgeOfLibertyJuice._active) return;
        if (!builtNodes || builtNodes.length === 0) return;
        var count = Math.min(2, builtNodes.length);
        var shuffled = builtNodes.slice().sort(function () { return Math.random() - 0.5; });
        var self = this;
        for (var i = 0; i < count; i++) {
            (function (node, delay) {
                setTimeout(function () { self.coinDrift(node.x, node.y, hudGoldId); }, delay);
            })(shuffled[i], i * 150);
        }
    },

    // ─── POPULATION MILESTONE ────────────────────────────────────────────
    populationMilestone: function (targetId) {
        if (!window.AgeOfLibertyJuice._active) return;
        var target = document.getElementById(targetId);
        var x, y;
        if (target) {
            var rect = target.getBoundingClientRect();
            x = rect.left + rect.width / 2;
            y = rect.top + rect.height / 2;
        } else {
            x = window.innerWidth / 2; y = 40;
        }
        var colors = ['#4ad8ff', '#f0c860', '#ffe9a8', '#8ae4ff', '#ffffff', '#d4a020'];
        for (var i = 0; i < 25; i++) {
            var c = colors[Math.floor(Math.random() * colors.length)];
            this.particleBurst(
                x + (Math.random() - 0.5) * 50,
                y + (Math.random() - 0.5) * 20,
                2 + Math.floor(Math.random() * 3), c, null
            );
        }
    },

    // ─── SCENARIO ENTRANCE ───────────────────────────────────────────────
    scenarioEntrance: function () {
        if (!window.AgeOfLibertyJuice._active) return;
        try { if (window.AgeOfLibertyAmbient) window.AgeOfLibertyAmbient.emit('cyan', 12); } catch (e) { }
        var card = document.querySelector('.scenario-card');
        if (!card) return;

        var head = card.querySelector('.scenario-head');
        var text = card.querySelector('.scenario-text');
        var choices = card.querySelectorAll('.choice-btn');

        if (head) { head.style.opacity = '0'; head.style.transform = 'translateX(-20px)'; }
        if (text) { text.style.opacity = '0'; text.style.transform = 'translateY(10px)'; }
        choices.forEach(function (c) { c.style.opacity = '0'; c.style.transform = 'translateY(15px)'; });

        var delay = 150;
        if (head) {
            setTimeout(function () {
                head.style.transition = 'all 0.4s cubic-bezier(0.34,1.56,0.64,1)';
                head.style.opacity = '1'; head.style.transform = 'translateX(0)';
            }, delay);
            delay += 250;
        }
        if (text) {
            setTimeout(function () {
                text.style.transition = 'all 0.4s ease-out';
                text.style.opacity = '1'; text.style.transform = 'translateY(0)';
            }, delay);
            delay += 350;
        }
        choices.forEach(function (c, i) {
            setTimeout(function () {
                c.style.transition = 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)';
                c.style.opacity = '1'; c.style.transform = 'translateY(0)';
            }, delay + i * 100);
        });
    },

    // ─── HUD BUMP ────────────────────────────────────────────────────────
    hudBump: function (elementId) {
        if (!window.AgeOfLibertyJuice._active) return;
        var el = document.getElementById(elementId);
        if (!el) return;
        el.style.transition = 'transform 0.15s cubic-bezier(0.34,1.56,0.64,1)';
        el.style.transform = 'scale(1.15)';
        setTimeout(function () { el.style.transform = 'scale(1)'; }, 150);
    },

    // ─── SVG COORDINATE HELPER ───────────────────────────────────────────
    svgToScreen: function (svgId, svgX, svgY) {
        var svg = document.getElementById(svgId);
        if (!svg || !svg.createSVGPoint) return { x: svgX, y: svgY };
        try {
            var pt = svg.createSVGPoint();
            pt.x = svgX;
            pt.y = svgY;
            var ctm = svg.getScreenCTM();
            if (!ctm) return { x: svgX, y: svgY };
            var sp = pt.matrixTransform(ctm);
            return { x: sp.x, y: sp.y };
        } catch (e) { return { x: svgX, y: svgY }; }
    },

    // ─── HIGH-LEVEL WRAPPERS (accept SVG coords) ─────────────────────────

    nodeTapAt: function (svgId, svgX, svgY) {
        if (!window.AgeOfLibertyJuice._active) return;
        var p = this.svgToScreen(svgId, svgX, svgY);
        this.ringPulse(p.x, p.y, 'rgba(74,216,255,0.5)', null);
    },

    buildCelebrationAt: function (svgId, svgX, svgY, popGain, cost) {
        if (!window.AgeOfLibertyJuice._active) return;
        try { if (window.AgeOfLibertyAmbient) window.AgeOfLibertyAmbient.emit('gold', 6); } catch (e) { }
        var p = this.svgToScreen(svgId, svgX, svgY);
        this.particleBurst(p.x, p.y, 14, '#f0c860', null);
        var self = this;
        setTimeout(function () { self.particleBurst(p.x, p.y, 8, '#ffe9a8', null); }, 80);
        this.ringPulse(p.x, p.y, '#d4a020', null);

        var flash = document.createElement('div');
        flash.style.cssText = 'position:fixed;left:' + p.x + 'px;top:' + p.y + 'px;' +
            'width:0;height:0;border-radius:50%;' +
            'background:rgba(190,235,255,0.5);pointer-events:none;z-index:3;' +
            'transform:translate(-50%,-50%);';
        document.body.appendChild(flash);
        var start = performance.now();
        function animFlash(now) {
            var t = (now - start) / 350;
            if (t >= 1) { flash.remove(); return; }
            var size = t < 0.3 ? (t / 0.3) * 70 : 70;
            flash.style.width = size + 'px';
            flash.style.height = size + 'px';
            flash.style.opacity = (t < 0.3 ? 0.6 : 0.6 * (1 - (t - 0.3) / 0.7)).toString();
            requestAnimationFrame(animFlash);
        }
        requestAnimationFrame(animFlash);

        if (popGain && popGain > 0) {
            this.floatText('+' + popGain + ' pop', p.x - 15, p.y - 50, '#8aa4c8', null);
        }
        this.floatText('-$' + cost, p.x + 20, p.y - 35, '#ff5648', null);
        this.shake('graphArea', 2, 200);
    },

    cascadeHitAt: function (svgId, svgX, svgY, priceChangePercent) {
        if (!window.AgeOfLibertyJuice._active) return;
        var p = this.svgToScreen(svgId, svgX, svgY);
        this.particleBurst(p.x, p.y, 10, '#ff5648', null);
        this.ringPulse(p.x, p.y, '#ff5648', null);
        this.shake('graphArea', 3, 250);
        if (priceChangePercent) {
            var sign = priceChangePercent > 0 ? '+' : '';
            this.floatText(sign + priceChangePercent + '%', p.x, p.y - 55, '#ff5648', null);
        }
    },

    travelingPulseAt: function (svgId, x1, y1, x2, y2, duration, color) {
        if (!window.AgeOfLibertyJuice._active) return;
        var p1 = this.svgToScreen(svgId, x1, y1);
        var p2 = this.svgToScreen(svgId, x2, y2);
        this.travelingPulse(p1.x, p1.y, p2.x, p2.y, duration || 500, color || '#ff5648', null);
    },

    incomeTickAt: function (svgId, builtNodesSvg, hudGoldId) {
        if (!window.AgeOfLibertyJuice._active) return;
        try { if (window.AgeOfLibertyAmbient) window.AgeOfLibertyAmbient.emit('gold', 3); } catch (e) { }
        if (!builtNodesSvg || builtNodesSvg.length === 0) return;
        var count = Math.min(2, builtNodesSvg.length);
        var shuffled = builtNodesSvg.slice().sort(function () { return Math.random() - 0.5; });
        var self = this;
        for (var i = 0; i < count; i++) {
            (function (node, delay) {
                setTimeout(function () {
                    var p = self.svgToScreen(svgId, node.x, node.y);
                    self.coinDrift(p.x, p.y, hudGoldId);
                }, delay);
            })(shuffled[i], i * 150);
        }
    },

    // ─── ATOM CARD REVEAL (for chest screen) ─────────────────────────────
    revealAtomCard: function (index) {
        var card = document.getElementById('atomCard_' + index);
        if (!card) return;

        card.style.display = 'flex';
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px) scale(0.7)';

        setTimeout(function () {
            card.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0) scale(1)';

            // Sparkle
            var rect = card.getBoundingClientRect();
            if (window.AgeOfLibertyJuice) {
                window.AgeOfLibertyJuice.particleBurst(
                    rect.left + rect.width / 2,
                    rect.top + rect.height / 2,
                    5, '#f0c860', null
                );
            }
        }, 30);

        // Play a tap sound
        if (window.AgeOfLibertyAudio && window.AgeOfLibertyAudio.sfxTap) {
            try { window.AgeOfLibertyAudio.sfxTap(); } catch (e) { }
        }
    },

    // ─── SHOW CHEST CONTINUE BUTTON ──────────────────────────────────────
    showChestContinue: function () {
        var btn = document.getElementById('chestContinueBtn');
        if (!btn) return;
        btn.style.display = 'block';
        btn.style.opacity = '0';
        btn.style.transform = 'translateY(20px)';
        setTimeout(function () {
            btn.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
            btn.style.opacity = '1';
            btn.style.transform = 'translateY(0)';
        }, 50);
    },

    // ─── REVEAL ERA STAT CARDS (staggered, same as chest cards) ──────────
    revealEraCards: function (count) {
        count = count || 3;
        for (var i = 0; i < count; i++) {
            (function (idx, delay) {
                setTimeout(function () {
                    var card = document.getElementById('eraStatCard_' + idx);
                    if (!card) return;
                    card.style.display = 'flex';
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(30px) scale(0.7)';
                    setTimeout(function () {
                        card.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0) scale(1)';
                        // Sparkle
                        var rect = card.getBoundingClientRect();
                        if (window.AgeOfLibertyJuice) {
                            window.AgeOfLibertyJuice.particleBurst(
                                rect.left + rect.width / 2,
                                rect.top + rect.height / 2,
                                5, '#f0c860', null
                            );
                        }
                    }, 30);
                    if (window.AgeOfLibertyAudio && window.AgeOfLibertyAudio.sfxTap) {
                        try { window.AgeOfLibertyAudio.sfxTap(); } catch (e) { }
                    }
                }, delay);
            })(i, 600 + i * 400);
        }
    }
};