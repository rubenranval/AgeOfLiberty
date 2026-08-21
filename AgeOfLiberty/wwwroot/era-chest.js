// ═══════════════════════════════════════════════════════════════════════════
// AGE OF LIBERTY — UNIFIED ERA + CHEST 3D MODULE
// One continuous Three.js scene: spinning badge → chest opens → atom cards
// ═══════════════════════════════════════════════════════════════════════════

window.AgeOfLibertyEra = {

    _scene: null, _camera: null, _renderer: null, _raf: null, _clock: null,
    _mixer: null,
    _phase: 'idle',  // idle | badge | transition | chest | open | done

    _badgeGroup: null,  // group wrapper for auto-centering
    _chest: null, _chestClips: [],
    _particles: [], _burstParticles: [], _shockwaves: [],
    _pointLight: null, _canvasId: null, _dotnetRef: null,
    _transitionStart: 0,

    // Badge camera target
    _camBadge: { x: 0, y: 0.5, z: 4.0, lx: 0, ly: 0, lz: 0 },
    // Chest camera target (slightly above, looking down)
    _camChest: { x: 0, y: 1.5, z: 3.2, lx: 0, ly: 0.1, lz: 0 },

    _makeGoldMaterial: function () {
        return new THREE.MeshStandardMaterial({
            color: new THREE.Color('#e8c050'),
            metalness: 0.75, roughness: 0.28,
            emissive: new THREE.Color('#3a2800'), emissiveIntensity: 0.15
        });
    },

    _initScene: function (canvasId) {
        this._canvasId = canvasId;
        var container = document.getElementById(canvasId);
        if (!container) return false;
        var w = window.innerWidth, h = window.innerHeight;

        this._scene = new THREE.Scene();
        this._camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
        // Start at badge camera position
        this._camera.position.set(this._camBadge.x, this._camBadge.y, this._camBadge.z);
        this._camera.lookAt(this._camBadge.lx, this._camBadge.ly, this._camBadge.lz);

        this._renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this._renderer.setSize(w, h);
        this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this._renderer.setClearColor(0x000000, 0);
        this._renderer.outputEncoding = THREE.sRGBEncoding;
        this._renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this._renderer.toneMappingExposure = 1.2;
        container.innerHTML = '';
        container.appendChild(this._renderer.domElement);

        this._scene.add(new THREE.AmbientLight(0xfff0d0, 0.4));
        this._pointLight = new THREE.PointLight(0xffcc66, 2.0, 12);
        this._pointLight.position.set(2, 3, 3);
        this._scene.add(this._pointLight);
        var back = new THREE.PointLight(0xd4a020, 0.7, 10);
        back.position.set(-2, 1, -2); this._scene.add(back);
        var rim = new THREE.PointLight(0xffeedd, 0.4, 8);
        rim.position.set(0, -2, 2); this._scene.add(rim);

        this._clock = new THREE.Clock();
        return true;
    },

    // ─── PARTICLES ───────────────────────────────────────────────────────
    _moteTexture: null,
    _spawnOrbitParticles: function (count, radius, ySpread, speed) {
        // Soft gold motes (matches the ambient particle language — no hard spheres)
        if (!this._moteTexture) this._moteTexture = this._makeGlowTexture(64, 0.2, 'rgba(240,205,110,0.9)');
        count = count || 25;
        for (var i = 0; i < count; i++) {
            var mat = new THREE.SpriteMaterial({
                map: this._moteTexture, transparent: true, opacity: 0,
                blending: THREE.AdditiveBlending, depthWrite: false
            });
            var mesh = new THREE.Sprite(mat);
            var s = 0.05 + Math.random() * 0.09;
            mesh.scale.set(s, s, 1);
            this._scene.add(mesh);
            this._particles.push({
                mesh: mesh, angle: (i / count) * Math.PI * 2,
                radius: (radius || 1.5) + (Math.random() - 0.5) * 0.5,
                speed: (speed || 0.5) + Math.random() * 0.4,
                yOff: (Math.random() - 0.5) * (ySpread || 1.0),
                phase: Math.random() * Math.PI * 2,
                baseOpacity: 0.2 + Math.random() * 0.3
            });
        }
    },
    _updateOrbitParticles: function (time) {
        for (var i = 0; i < this._particles.length; i++) {
            var p = this._particles[i];
            var a = p.angle + time * p.speed;
            var r = p.radius + Math.sin(time * 2 + p.phase) * 0.08;
            p.mesh.position.set(Math.cos(a) * r, p.yOff + 0.15 + Math.sin(time * 1.5 + p.phase) * 0.12, Math.sin(a) * r);
            p.mesh.material.opacity = p.baseOpacity + Math.sin(time * 3 + p.phase) * 0.2;
        }
    },
    _spawnBurst: function (origin, count, color, speed, lifetime) {
        var geo = new THREE.SphereGeometry(0.03, 6, 6);
        for (var i = 0; i < (count || 30); i++) {
            var mat = new THREE.MeshBasicMaterial({ color: color || 0xf0c860, transparent: true, opacity: 1 });
            var mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(origin);
            var dir = new THREE.Vector3((Math.random() - .5) * 2, Math.random() * 1.5 + .3, (Math.random() - .5) * 2).normalize();
            this._scene.add(mesh);
            this._burstParticles.push({
                mesh: mesh, vel: dir.multiplyScalar((speed || 3) * (0.4 + Math.random() * 0.6)),
                life: 0, maxLife: (lifetime || 1.5) * (0.4 + Math.random() * 0.6)
            });
        }
    },
    _updateBurst: function (dt) {
        for (var i = this._burstParticles.length - 1; i >= 0; i--) {
            var p = this._burstParticles[i]; p.life += dt;
            if (p.life >= p.maxLife) { this._scene.remove(p.mesh); this._burstParticles.splice(i, 1); continue; }
            var t = p.life / p.maxLife;
            p.mesh.position.add(p.vel.clone().multiplyScalar(dt * (1 - t * 0.7)));
            p.vel.y -= dt * 2;
            p.mesh.material.opacity = 1 - t;
            var s = 1 - t * 0.6; p.mesh.scale.set(s, s, s);
        }
    },
    _spawnShockwave: function (y) {
        var geo = new THREE.RingGeometry(0.1, 0.15, 32);
        var mat = new THREE.MeshBasicMaterial({ color: 0xf0c860, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
        var mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2; mesh.position.y = y || 0;
        this._scene.add(mesh); this._shockwaves.push({ mesh: mesh, life: 0 });
    },
    _updateShockwaves: function (dt) {
        for (var i = this._shockwaves.length - 1; i >= 0; i--) {
            var sw = this._shockwaves[i]; sw.life += dt; var t = sw.life / 1.2;
            if (t >= 1) { this._scene.remove(sw.mesh); this._shockwaves.splice(i, 1); continue; }
            var s = 1 + t * 12; sw.mesh.scale.set(s, s, s); sw.mesh.material.opacity = 0.8 * (1 - t);
        }
    },

    // ─── CAMERA LERP ─────────────────────────────────────────────────────
    _lerpCamera: function (from, to, t) {
        t = Math.min(1, Math.max(0, t));
        var ease = t * t * (3 - 2 * t); // smoothstep
        this._camera.position.set(
            from.x + (to.x - from.x) * ease,
            from.y + (to.y - from.y) * ease,
            from.z + (to.z - from.z) * ease
        );
        this._camera.lookAt(
            from.lx + (to.lx - from.lx) * ease,
            from.ly + (to.ly - from.ly) * ease,
            from.lz + (to.lz - from.lz) * ease
        );
    },

    // ─── PHASE 1: SHOW BADGE ─────────────────────────────────────────────
    showBadge: function (canvasId, eraColor) {
        this.destroy();
        if (!this._initScene(canvasId)) return;
        this._phase = 'badge';

        this._spawnOrbitParticles(22, 1.4, 0.9, 0.6);
        this._spawnShockwave(0);
        var self = this;
        setTimeout(function () { self._spawnShockwave(0); }, 400);

        // Load SFL badge GLB — matching original: scale 0.4, auto-centered in group
        var goldMat = this._makeGoldMaterial();
        this._badgeGroup = new THREE.Group();
        this._badgeGroup.position.y = 0.15;    // slightly above center; cards live below now
        this._scene.add(this._badgeGroup);

        var loader = new THREE.GLTFLoader();
        loader.load('assets/3D/sfl-badge.glb', function (gltf) {
            var model = gltf.scene;
            model.scale.set(0.3, 0.3, 0.3);

            // Auto-center using bounding box (from original code)
            var box = new THREE.Box3().setFromObject(model);
            var center = box.getCenter(new THREE.Vector3());
            model.position.x = -center.x;
            model.position.y = -center.y;
            model.position.z = -center.z;

            model.traverse(function (child) {
                if (child.isMesh) {
                    child.material = goldMat;
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            self._badgeGroup.add(model);
            // Start invisible, scale in via render loop
            self._badgeGroup.scale.set(0, 0, 0);
        }, undefined, function () {
            // Fallback if GLB missing
            var geo = new THREE.IcosahedronGeometry(0.4, 1);
            var mesh = new THREE.Mesh(geo, goldMat);
            self._badgeGroup.add(mesh);
            self._badgeGroup.scale.set(0, 0, 0);
        });

        this._startLoop();
    },

    // ─── PHASE 1.5: ADDRESS MODE ─────────────────────────────────────────
    // The engine speaks: badge sheds its gold skin for the intro's cyan
    // wireframe ghost, and the particle field thickens. Called when the
    // era address screen appears; the chest transition fades it all out.
    addressMode: function () {
        if (!this._scene) return;
        var self = this;

        // Badge → intro-style dual skin: faint solid ghost + cyan wireframe
        if (this._badgeGroup) {
            var wires = [];
            this._badgeGroup.traverse(function (node) {
                if (node.isMesh && !node.userData.aolWire) {
                    node.material = new THREE.MeshBasicMaterial({
                        color: 0xffffff, transparent: true, opacity: 0.07
                    });
                    var wire = new THREE.Mesh(node.geometry, new THREE.MeshBasicMaterial({
                        color: 0x4ad8ff, wireframe: true, transparent: true, opacity: 0.85
                    }));
                    wire.userData.aolWire = true;
                    wires.push({ parent: node, mesh: wire });
                }
            });
            for (var w = 0; w < wires.length; w++) wires[w].parent.add(wires[w].mesh);
        }

        // Thicken the field: two extra slow orbit shells, wide and ambient
        this._spawnOrbitParticles(30, 2.3, 1.8, 0.22);
        this._spawnOrbitParticles(18, 3.1, 2.4, 0.14);
    },

    // ─── PHASE 2: TRANSITION TO CHEST ────────────────────────────────────
    transitionToChest: function (dotnetRef) {
        this._dotnetRef = dotnetRef;
        this._phase = 'transition';
        this._transitionStart = this._clock.getElapsedTime();

        // Preload chest — keep original textures
        var self = this;
        var loader = new THREE.GLTFLoader();
        loader.load('assets/3D/chest.glb', function (gltf) {
            self._chest = gltf.scene;
            self._chestClips = gltf.animations || [];

            // Strip position and scale tracks from ALL animation clips.
            // The GLB's animation likely has root-level position/scale keyframes
            // that cause the chest to jump. We only want rotation tracks (lid opening).
            for (var c = 0; c < self._chestClips.length; c++) {
                var clip = self._chestClips[c];
                clip.tracks = clip.tracks.filter(function (track) {
                    // Keep quaternion and rotation tracks, remove position and scale
                    var prop = track.name.split('.').pop();
                    return prop === 'quaternion' || prop === 'rotation';
                });
            }

            if (self._chestClips.length > 0) {
                self._mixer = new THREE.AnimationMixer(self._chest);
            }

            // Also freeze the inner model's transform so no residual animation data
            // can shift it within the group
            self._chest.position.set(0, 0, 0);
            self._chest.scale.set(1, 1, 1);
            self._chest.rotation.set(0, 0, 0);

            // Store original position and scale of every node in the chest hierarchy.
            // After each mixer update we'll restore these so only rotations change.
            self._chestOriginalTransforms = [];
            self._chest.traverse(function (node) {
                self._chestOriginalTransforms.push({
                    node: node,
                    px: node.position.x, py: node.position.y, pz: node.position.z,
                    sx: node.scale.x, sy: node.scale.y, sz: node.scale.z
                });
            });

            // Wrap in a parent group — our code controls the GROUP transform,
            // the animation mixer only controls lid rotation inside.
            self._chestGroup = new THREE.Group();
            self._chestGroup.scale.set(0, 0, 0);
            self._chestGroup.position.set(0, -0.3, 0);
            self._chestGroup.rotation.y = Math.PI; // facing away

            self._chestGroup.add(self._chest);
            self._scene.add(self._chestGroup);
        }, undefined, function (err) {
            console.warn('Chest load error:', err);
        });
    },

    // ─── SOFT VOLUMETRIC GLOW (sprite-based) ────────────────────────────────
    _glowSprites: [],
    _chestGlowLight: null,
    _glowCanvas: null,

    // Generate a soft radial gradient texture via canvas
    _makeGlowTexture: function (size, coreRadius, color) {
        size = size || 256;
        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');
        var half = size / 2;

        var gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
        gradient.addColorStop(0, color || 'rgba(220,165,40,0.6)');
        gradient.addColorStop(coreRadius || 0.15, color || 'rgba(210,155,30,0.3)');
        gradient.addColorStop(0.5, 'rgba(200,140,20,0.08)');
        gradient.addColorStop(1, 'rgba(180,120,10,0.0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        var tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        return tex;
    },

    _spawnGlow: function () {
        // Main large soft glow — rich warm gold
        var mainTex = this._makeGlowTexture(256, 0.1, 'rgba(220,165,40,0.5)');
        var mainMat = new THREE.SpriteMaterial({
            map: mainTex,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        var mainSprite = new THREE.Sprite(mainMat);
        mainSprite.scale.set(0, 0, 1);
        mainSprite.position.set(0, 0.65, 0);
        this._scene.add(mainSprite);

        // Smaller brighter core — intense warm gold
        var coreTex = this._makeGlowTexture(128, 0.3, 'rgba(240,180,30,0.8)');
        var coreMat = new THREE.SpriteMaterial({
            map: coreTex,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        var coreSprite = new THREE.Sprite(coreMat);
        coreSprite.scale.set(0, 0, 1);
        coreSprite.position.set(0, 0.55, 0);
        this._scene.add(coreSprite);

        // Upper secondary — warm amber spill
        var topTex = this._makeGlowTexture(128, 0.05, 'rgba(230,170,50,0.35)');
        var topMat = new THREE.SpriteMaterial({
            map: topTex,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        var topSprite = new THREE.Sprite(topMat);
        topSprite.scale.set(0, 0, 1);
        topSprite.position.set(0, 0.9, 0);
        this._scene.add(topSprite);

        this._glowSprites = [
            { sprite: mainSprite, targetScale: 2.0, targetOpacity: 0.7, yOffset: 0.5 },
            { sprite: coreSprite, targetScale: 0.8, targetOpacity: 0.9, yOffset: 0.4 },
            { sprite: topSprite, targetScale: 1.2, targetOpacity: 0.4, yOffset: 0.9 }
        ];

        // Point light from inside chest — warm gold
        this._chestGlowLight = new THREE.PointLight(0xd4a030, 0, 4);
        this._chestGlowLight.position.set(0, 0.3, 0);
        this._scene.add(this._chestGlowLight);

        this._glowLife = 0;
        this._glowFade = 1; // 1 = full, fades to 0 on close
    },

    _glowLife: 0,
    _glowFade: 1,

    _updateGlow: function (dt) {
        if (this._glowSprites.length === 0) return;
        this._glowLife += dt;

        // Fade in over 1.5s
        var fadeIn = Math.min(1, this._glowLife / 1.5);
        var ease = fadeIn * fadeIn * (3 - 2 * fadeIn);
        var fade = ease * this._glowFade;

        for (var i = 0; i < this._glowSprites.length; i++) {
            var g = this._glowSprites[i];
            var breathe = 1 + Math.sin(this._glowLife * 1.2 + i * 1.5) * 0.06;
            var s = g.targetScale * fade * breathe;
            g.sprite.scale.set(s, s, 1);
            g.sprite.material.opacity = g.targetOpacity * fade;

            // Follow chest group position
            if (this._chestGroup) {
                g.sprite.position.y = this._chestGroup.position.y + g.yOffset;
                g.sprite.position.x = this._chestGroup.position.x;
                g.sprite.position.z = this._chestGroup.position.z;
            }
        }

        // Light follows chest group
        if (this._chestGlowLight) {
            this._chestGlowLight.intensity = fade * 2.0 + Math.sin(this._glowLife * 1.2) * 0.2 * fade;
            if (this._chestGroup) {
                this._chestGlowLight.position.x = this._chestGroup.position.x;
                this._chestGlowLight.position.y = this._chestGroup.position.y + 0.3;
                this._chestGlowLight.position.z = this._chestGroup.position.z;
            }
        }
    },

    // ─── PHASE 3: OPEN CHEST ─────────────────────────────────────────────
    openChest: function () {
        if (this._phase === 'open' || this._phase === 'done') return;
        this._phase = 'open';

        if (this._mixer && this._chestClips.length > 0) {
            var action = this._mixer.clipAction(this._chestClips[0]);
            action.setLoop(THREE.LoopOnce);
            action.clampWhenFinished = true;
            action.play();
        }

        var origin = new THREE.Vector3(0, 0.4, 0);

        // Soft sprite-based volumetric glow from inside chest
        this._spawnGlow();

        // Gentle light warmth increase
        if (this._pointLight) {
            this._pointLight.intensity = 3.0;
            this._pointLight.color.set(0xfff0c0);
            var self = this;
            setTimeout(function () {
                self._pointLight.intensity = 2.0;
                self._pointLight.color.set(0xffcc66);
            }, 1500);
        }

        var self = this;
        setTimeout(function () {
            self._phase = 'done';
            if (self._dotnetRef) self._dotnetRef.invokeMethodAsync('OnChestOpened');
        }, 1200);
    },

    // ─── RENDER LOOP ─────────────────────────────────────────────────────
    _startLoop: function () {
        var self = this;
        var badgeAppearDelay = 0.3;

        function loop() {
            self._raf = requestAnimationFrame(loop);
            var dt = self._clock.getDelta();
            var time = self._clock.getElapsedTime();

            self._updateOrbitParticles(time);
            self._updateBurst(dt);
            self._updateShockwaves(dt);
            self._updateGlow(dt);
            if (self._mixer) self._mixer.update(dt);

            // Restore position and scale for all chest nodes after animation update.
            // Only rotation changes (lid opening) are kept.
            if (self._chestOriginalTransforms) {
                for (var ot = 0; ot < self._chestOriginalTransforms.length; ot++) {
                    var orig = self._chestOriginalTransforms[ot];
                    orig.node.position.set(orig.px, orig.py, orig.pz);
                    orig.node.scale.set(orig.sx, orig.sy, orig.sz);
                }
            }

            // ── BADGE ──
            if (self._phase === 'badge' && self._badgeGroup) {
                // Camera stays at badge position
                self._camera.position.set(self._camBadge.x, self._camBadge.y, self._camBadge.z);
                self._camera.lookAt(self._camBadge.lx, self._camBadge.ly, self._camBadge.lz);

                // Scale in with elastic bounce
                var t = Math.min(1, Math.max(0, (time - badgeAppearDelay) / 0.8));
                if (t > 0) {
                    var ease = t < 1 ? 1 - Math.pow(1 - t, 3) + Math.sin(t * Math.PI) * 0.12 : 1;
                    self._badgeGroup.scale.setScalar(Math.max(0, ease));
                }
                // Spin on Y axis
                self._badgeGroup.rotation.y += dt * 2.2;
                // Gentle bob
                self._badgeGroup.position.y = Math.sin(time * 1.5) * 0.04;
            }

            // ── TRANSITION ──
            if (self._phase === 'transition') {
                var elapsed = time - self._transitionStart;

                // Shrink badge (0–0.8s)
                if (self._badgeGroup) {
                    var shrinkT = Math.min(1, elapsed / 0.8);
                    self._badgeGroup.scale.setScalar(1 - shrinkT);
                    self._badgeGroup.rotation.y += dt * (2.2 + shrinkT * 8);
                    if (shrinkT >= 1 && self._badgeGroup.parent) {
                        self._scene.remove(self._badgeGroup);
                        self._badgeGroup = null;
                    }
                }

                // Animate camera from badge position to chest position (0–2.4s)
                var camT = Math.min(1, elapsed / 2.4);
                self._lerpCamera(self._camBadge, self._camChest, camT);

                // Contract orbit particles (0–1s)
                var contractT = Math.min(1, elapsed / 1.0);
                for (var i = 0; i < self._particles.length; i++) {
                    self._particles[i].radius = 1.5 - contractT * 0.8;
                }

                // Chest appears (0.6–2.2s) — longer rotation for drama
                if (self._chestGroup && elapsed > 0.6) {
                    var ct = Math.min(1, (elapsed - 0.6) / 1.6);
                    var ease = ct < 1 ? 1 - Math.pow(1 - ct, 3) + Math.sin(ct * Math.PI) * 0.1 : 1;
                    self._chestGroup.scale.setScalar(Math.max(0, ease * 0.6));
                    self._chestGroup.position.y = -0.3 + ct * 0.3;
                    self._chestGroup.rotation.y = Math.PI * (1 - ct); // rotate to face camera

                    // Expand particles back out around chest
                    for (var i = 0; i < self._particles.length; i++) {
                        self._particles[i].radius = 0.7 + ct * 0.8;
                    }
                }

                if (elapsed > 2.6) {
                    self._phase = 'chest';
                    setTimeout(function () { self.openChest(); }, 1200);
                }
            }

            // ── CHEST WAITING ──
            if (self._phase === 'chest' && self._chestGroup) {
                self._chestGroup.position.y = Math.sin(time * 1.3) * 0.02;
                if (self._pointLight) self._pointLight.intensity = 2.0 + Math.sin(time * 2) * 0.3;
            }

            // ── DONE ──
            if (self._phase === 'done' && self._chestGroup) {
                self._chestGroup.position.y = Math.sin(time * 1.3) * 0.015;
            }

            // ── SLIDING DOWN ──
            if (self._phase === 'sliding' && self._chestGroup) {
                var slideT = Math.min(1, (time - self._slideStart) / 0.8);
                var ease = slideT * slideT * (3 - 2 * slideT); // smoothstep
                self._chestGroup.position.y = self._slideFromY + (self._slideToY - self._slideFromY) * ease;
                var s = self._slideFromScale + (self._slideToScale - self._slideFromScale) * ease;
                self._chestGroup.scale.set(s, s, s);
                if (slideT >= 1) {
                    self._phase = 'settled';
                }
            }

            // ── SETTLED (after slide) ──
            if (self._phase === 'settled' && self._chestGroup) {
                self._chestGroup.position.y = self._slideToY + Math.sin(time * 1.3) * 0.01;
            }

            self._renderer.render(self._scene, self._camera);
        }
        this._clock.start();
        loop();
    },

    // ─── FADE OUT ────────────────────────────────────────────────────────
    // ─── SLIDE CHEST DOWN ───────────────────────────────────────────────
    // After all cards revealed, move chest toward bottom of viewport
    slideChestDown: function () {
        if (!this._chestGroup) return;
        if (this._phase === 'sliding' || this._phase === 'settled') return; // guard against double-call

        this._slideStart = this._clock.getElapsedTime();
        this._slideFromY = this._chestGroup.position.y;
        this._slideToY = -0.8;
        this._slideFromScale = this._chestGroup.scale.x;
        this._slideToScale = this._slideFromScale * 0.7;
        this._phase = 'sliding';

        // Play chest animation in reverse to close the lid
        if (this._mixer && this._chestClips.length > 0) {
            var action = this._mixer.clipAction(this._chestClips[0]);
            action.paused = false;
            action.timeScale = -1;
            action.setLoop(THREE.LoopOnce);
            action.clampWhenFinished = true;
            if (!action.isRunning()) {
                action.play();
            }
        }

        // Fade out glow smoothly during slide
        var self = this;
        var fadeStart = this._clock.getElapsedTime();
        var fadeDuration = 0.8;

        function fadeGlow() {
            if (self._phase !== 'sliding' && self._phase !== 'settled') return;
            var t = Math.min(1, (self._clock.getElapsedTime() - fadeStart) / fadeDuration);
            self._glowFade = 1 - t; // _updateGlow reads this
            if (t < 1) requestAnimationFrame(fadeGlow);
        }
        requestAnimationFrame(fadeGlow);
    },

    fadeOut: function (duration) {
        var container = document.getElementById(this._canvasId);
        if (container) {
            container.style.transition = 'opacity ' + (duration || 0.6) + 's ease-out';
            container.style.opacity = '0';
        }
        var self = this;
        setTimeout(function () { self.destroy(); }, (duration || 0.6) * 1000 + 50);
    },

    // ─── DESTROY ─────────────────────────────────────────────────────────
    destroy: function () {
        if (this._raf) cancelAnimationFrame(this._raf); this._raf = null;
        [this._particles, this._burstParticles, this._shockwaves].forEach(function (arr) {
            for (var i = 0; i < arr.length; i++) { if (this._scene) this._scene.remove(arr[i].mesh); }
        }.bind(this));
        this._particles = []; this._burstParticles = []; this._shockwaves = [];
        for (var i = 0; i < this._glowSprites.length; i++) {
            this._scene.remove(this._glowSprites[i].sprite);
        }
        this._glowSprites = [];
        if (this._chestGlowLight) {
            this._scene.remove(this._chestGlowLight);
            this._chestGlowLight = null;
        }
        if (this._badgeGroup && this._scene) this._scene.remove(this._badgeGroup);
        if (this._chestGroup && this._scene) this._scene.remove(this._chestGroup);
        this._badgeGroup = null; this._chestGroup = null; this._chest = null;
        this._mixer = null; this._chestClips = []; this._chestOriginalTransforms = null;
        if (this._renderer) {
            this._renderer.dispose();
            var c = document.getElementById(this._canvasId); if (c) c.innerHTML = '';
        }
        this._renderer = null; this._scene = null; this._camera = null;
        this._clock = null; this._phase = 'idle'; this._dotnetRef = null;
    }
};