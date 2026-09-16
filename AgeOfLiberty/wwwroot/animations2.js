window.AoLDisposeObject3D = function (root) {
    if (!root || typeof root.traverse !== 'function') return;
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    root.traverse(function (node) {
        if (node.geometry) geometries.add(node.geometry);
        const nodeMaterials = Array.isArray(node.material) ? node.material : (node.material ? [node.material] : []);
        nodeMaterials.forEach(function (material) {
            materials.add(material);
            Object.keys(material).forEach(function (key) {
                const value = material[key];
                if (value && value.isTexture) textures.add(value);
            });
        });
    });
    textures.forEach(function (texture) { texture.dispose(); });
    materials.forEach(function (material) { material.dispose(); });
    geometries.forEach(function (geometry) { geometry.dispose(); });
};

window.AgeOfLiberty = {

    setText: function (elementId, value) {
        const element = document.getElementById(elementId);
        if (element && element.textContent !== value) element.textContent = value;
    },

    // ─── BACKGROUND PARTICLES ───────────────────────────────────────────────
    _bgRaf: null,
    _bgParticles: [],

    initParticles: function (canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        let W = window.innerWidth;
        let H = window.innerHeight;
        canvas.width = W;
        canvas.height = H;

        const onResize = () => {
            W = window.innerWidth;
            H = window.innerHeight;
            canvas.width = W;
            canvas.height = H;
        };
        window.addEventListener('resize', onResize);

        const N = 55;
        this._bgParticles = [];
        for (let i = 0; i < N; i++) {
            this._bgParticles.push({
                x: Math.random() * W,
                y: Math.random() * H,
                vx: (Math.random() - 0.5) * 0.25,
                vy: (Math.random() - 0.5) * 0.25,
                r: Math.random() * 1.5 + 0.3,
                a: Math.random() * 0.35 + 0.08,
                pulse: Math.random() * Math.PI * 2,
            });
        }

        if (this._bgRaf) cancelAnimationFrame(this._bgRaf);

        const self = this;
        const draw = () => {
            ctx.clearRect(0, 0, W, H);
            const pts = self._bgParticles;

            for (const p of pts) {
                p.x += p.vx;
                p.y += p.vy;
                p.pulse += 0.012;
                if (p.x < 0) p.x = W;
                if (p.x > W) p.x = 0;
                if (p.y < 0) p.y = H;
                if (p.y > H) p.y = 0;

                const alpha = p.a * (0.5 + 0.5 * Math.sin(p.pulse));
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(80,160,255,${alpha})`;
                ctx.fill();
            }

            for (let i = 0; i < pts.length; i++) {
                for (let j = i + 1; j < pts.length; j++) {
                    const dx = pts[i].x - pts[j].x;
                    const dy = pts[i].y - pts[j].y;
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d < 110) {
                        ctx.beginPath();
                        ctx.moveTo(pts[i].x, pts[i].y);
                        ctx.lineTo(pts[j].x, pts[j].y);
                        ctx.strokeStyle = `rgba(60,140,240,${0.1 * (1 - d / 110)})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }

            self._bgRaf = requestAnimationFrame(draw);
        };

        draw();
    },

    stopParticles: function () {
        if (this._bgRaf) {
            cancelAnimationFrame(this._bgRaf);
            this._bgRaf = null;
        }
    },

    // ─── TOUCH GESTURES (pan + pinch-to-zoom + tap passthrough) ────────────
    _gestureState: null,
    _dotnetRef: null,
    _gestureCleanup: null,
    _gestureNotifyTimer: null,

    initTouchGestures: function (elementId, dotnetRef, panX, panY, zoom) {
        this.destroyTouchGestures();
        const el = document.getElementById(elementId);
        if (!el) return;

        this._dotnetRef = dotnetRef;

        const TAP_THRESHOLD = 10; // px — below this, it's a tap not a drag

        const state = {
            isPanning: false,
            startX: 0, startY: 0,
            touchStartX: 0, touchStartY: 0,
            hasMoved: false,
            initialPinchDist: 0,
            initialZoom: 1,
            currentZoom: typeof zoom === 'number' ? zoom : 1,
            panX: typeof panX === 'number' ? panX : 0,
            panY: typeof panY === 'number' ? panY : 0,
        };
        this._gestureState = state;
        this._applyTransform(el, state);

        const onTouchStart = (e) => {
            if (e.touches.length === 1) {
                state.hasMoved = false;
                state.touchStartX = e.touches[0].clientX;
                state.touchStartY = e.touches[0].clientY;
                state.startX = e.touches[0].clientX - state.panX;
                state.startY = e.touches[0].clientY - state.panY;
                state.isPanning = false; // Don't start panning yet — wait for movement
            } else if (e.touches.length === 2) {
                e.preventDefault();
                state.isPanning = false;
                state.hasMoved = true; // Pinch is not a tap
                state.initialPinchDist = this._pinchDist(e.touches);
                state.initialZoom = state.currentZoom;
            }
        };

        const onTouchMove = (e) => {
            // Prevent the native WebView from scrolling while the map is being
            // manipulated. One non-passive listener is enough; the previous
            // implementation registered two listeners on every map visit.
            e.preventDefault();
            if (e.touches.length === 1) {
                const dx = e.touches[0].clientX - state.touchStartX;
                const dy = e.touches[0].clientY - state.touchStartY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > TAP_THRESHOLD) {
                    state.hasMoved = true;
                    state.isPanning = true;
                }

                if (state.isPanning) {
                    state.panX = e.touches[0].clientX - state.startX;
                    state.panY = e.touches[0].clientY - state.startY;
                    this._applyTransform(el, state);
                }
            } else if (e.touches.length === 2) {
                const dist = this._pinchDist(e.touches);
                const scale = dist / state.initialPinchDist;
                state.currentZoom = Math.max(0.4, Math.min(2.5, state.initialZoom * scale));
                this._applyTransform(el, state);
            }
        };

        const onTouchEnd = (e) => {
            if (!state.hasMoved && e.changedTouches.length > 0) {
                // It was a tap — find the element under the finger and click it
                const touch = e.changedTouches[0];
                const target = document.elementFromPoint(touch.clientX, touch.clientY);
                if (target) {
                    // Walk up to find a clickable node
                    const node = target.closest('[data-node]');
                    if (node) {
                        node.click();
                    }
                }
            }

            state.isPanning = false;
            if (e.touches.length === 1) {
                state.startX = e.touches[0].clientX - state.panX;
                state.startY = e.touches[0].clientY - state.panY;
            }

            if (state.hasMoved) {
                this._notifyBlazor(state);
            }
        };

        // Desktop mouse drag
        let mouseDown = false;
        const onMouseDown = (e) => {
            if (e.target.closest('[data-node]')) return;
            mouseDown = true;
            state.startX = e.clientX - state.panX;
            state.startY = e.clientY - state.panY;
            el.style.cursor = 'grabbing';
        };
        const onMouseMove = (e) => {
            if (!mouseDown) return;
            state.panX = e.clientX - state.startX;
            state.panY = e.clientY - state.startY;
            this._applyTransform(el, state);
        };
        const onMouseUp = () => {
            if (mouseDown) {
                mouseDown = false;
                el.style.cursor = 'grab';
                this._notifyBlazor(state);
            }
        };

        // Desktop wheel zoom
        const onWheel = (e) => {
            e.preventDefault();
            state.currentZoom = Math.max(0.4, Math.min(2.5, state.currentZoom + (e.deltaY > 0 ? -0.1 : 0.1)));
            this._applyTransform(el, state);
            this._queueGestureNotify(state);
        };

        el.addEventListener('touchstart', onTouchStart, { passive: false });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd);
        el.addEventListener('mousedown', onMouseDown);
        el.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        this._gestureCleanup = function () {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
            el.removeEventListener('mousedown', onMouseDown);
            el.removeEventListener('wheel', onWheel);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    },

    destroyTouchGestures: function () {
        if (this._gestureCleanup) this._gestureCleanup();
        this._gestureCleanup = null;
        this._gestureState = null;
        this._dotnetRef = null;
        if (this._gestureNotifyTimer) clearTimeout(this._gestureNotifyTimer);
        this._gestureNotifyTimer = null;
    },

    resetGesture: function () {
        if (this._gestureState) {
            this._gestureState.panX = 0;
            this._gestureState.panY = 0;
            this._gestureState.currentZoom = 1;
            const el = document.getElementById('graphArea');
            if (el) this._applyTransform(el, this._gestureState);
            this._notifyBlazor(this._gestureState);
        }
    },

    setGestureState: function (panX, panY, zoom) {
        if (this._gestureState) {
            this._gestureState.panX = panX;
            this._gestureState.panY = panY;
            this._gestureState.currentZoom = zoom;
            const el = document.getElementById('graphArea');
            if (el) this._applyTransform(el, this._gestureState);
        }
    },

    _applyTransform: function (el, state) {
        const svg = el.querySelector('.atom-svg') || el;
        svg.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.currentZoom})`;
    },

    _notifyBlazor: function (state) {
        if (this._dotnetRef) {
            this._dotnetRef.invokeMethodAsync('OnGestureUpdate', state.panX, state.panY, state.currentZoom)
                .catch(function () { /* page was disposed */ });
        }
    },

    _queueGestureNotify: function (state) {
        if (this._gestureNotifyTimer) clearTimeout(this._gestureNotifyTimer);
        const self = this;
        this._gestureNotifyTimer = setTimeout(function () {
            self._gestureNotifyTimer = null;
            self._notifyBlazor(state);
        }, 80);
    },

    _pinchDist: function (touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    },

    // ─── EDGE PARTICLES ─────────────────────────────────────────────────────
    _edgeRaf: null,
    _edgeParticles: [],
    _edges: [],
    _edgeGroup: null,
    _edgeLastFrame: 0,

    initEdgeParticles: function (svgId) {
        const svg = document.getElementById(svgId);
        if (!svg) return;

        let group = document.getElementById('edge-particles-group');
        if (!group) {
            group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.id = 'edge-particles-group';
            svg.appendChild(group);
        }

        this.stopEdgeParticles();
        this._edgeGroup = group;

        const self = this;
        const draw = (now) => {
            self._edgeRaf = requestAnimationFrame(draw);
            if (now - self._edgeLastFrame < 33) return;
            self._edgeLastFrame = now;
            for (const p of self._edgeParticles) {
                p.t += p.speed;
                if (p.t > 1) p.t -= 1;
                const edge = self._edges[p.edgeIdx];
                if (!edge) continue;
                const x = edge.x1 + (edge.x2 - edge.x1) * p.t;
                const y = edge.y1 + (edge.y2 - edge.y1) * p.t;
                const opacity = (0.35 + 0.35 * Math.sin(p.t * Math.PI * 2)).toFixed(2);
                p.node.setAttribute('cx', x.toFixed(1));
                p.node.setAttribute('cy', y.toFixed(1));
                p.node.setAttribute('opacity', opacity);
            }
        };

        this._edgeRaf = requestAnimationFrame(draw);
    },

    updateEdges: function (edges) {
        this._edges = edges || [];
        this._edgeParticles = [];
        const group = this._edgeGroup;
        if (group) group.replaceChildren();
        for (let i = 0; i < this._edges.length; i++) {
            const count = 1 + Math.floor(Math.random() * 2);
            for (let j = 0; j < count; j++) {
                const node = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                node.setAttribute('r', '1.6');
                node.setAttribute('fill', '#4aeadc');
                if (group) group.appendChild(node);
                this._edgeParticles.push({
                    edgeIdx: i,
                    t: Math.random(),
                    speed: 0.002 + Math.random() * 0.003,
                    node: node,
                });
            }
        }
    },

    stopEdgeParticles: function () {
        if (this._edgeRaf) {
            cancelAnimationFrame(this._edgeRaf);
            this._edgeRaf = null;
        }
        this._edgeLastFrame = 0;
        if (this._edgeGroup) this._edgeGroup.replaceChildren();
        this._edgeParticles = [];
        this._edges = [];
    },

    deactivateMap: function () {
        this.destroyTouchGestures();
        this.stopEdgeParticles();
    },

    // ─── SHARE ──────────────────────────────────────────────────────────────
    shareCity: async function (text) {
        if (navigator.share) {
            try {
                await navigator.share({ title: 'Age of Liberty', text: text });
                return true;
            } catch (e) { return false; }
        } else {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (e) { return false; }
        }
    },


    // ─── ERA UNLOCK 3D ANIMATION ────────────────────────────────────────────
    _era3d: {
        scene: null, camera: null, renderer: null,
        group: null, waves: [], sparks: [], particles: null,
        clock: null, frameId: null, active: false,
        glbPath: 'assets/3D/sfl-badge.glb',
        _glowTexture: null, _isScalingIn: false,

        _createGlowTexture: function (r, g, b) {
            var c = document.createElement('canvas');
            c.width = 64; c.height = 64;
            var ctx = c.getContext('2d');
            var grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
            grad.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',1)');
            grad.addColorStop(0.15, 'rgba(' + r + ',' + g + ',' + b + ',0.8)');
            grad.addColorStop(0.4, 'rgba(' + r + ',' + g + ',' + b + ',0.25)');
            grad.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 64, 64);
            return new THREE.CanvasTexture(c);
        },

        init: function (containerId) {
            var container = document.getElementById(containerId);
            if (!container) return;

            this.scene = new THREE.Scene();
            this.scene.fog = new THREE.FogExp2(0x2a2010, 0.012);

            this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
            this.camera.position.set(0, 0, 10);

            this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            var perf = window.AoLPerformance || {};
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, perf.pixelRatioCap || 1.75));
            container.innerHTML = '';
            container.appendChild(this.renderer.domElement);

            this.group = new THREE.Group();
            this.scene.add(this.group);

            // Warm golden lighting
            this.scene.add(new THREE.AmbientLight(0xffeedd, 0.5));
            var dl = new THREE.DirectionalLight(0xffeebb, 2.5);
            dl.position.set(5, 5, 7); this.scene.add(dl);
            var dl2 = new THREE.DirectionalLight(0xffddaa, 1.0);
            dl2.position.set(-3, -2, 5); this.scene.add(dl2);
            var sl = new THREE.SpotLight(0xffaa00, 12);
            sl.position.set(-5, 5, -5); sl.lookAt(0, 0, 0); this.scene.add(sl);

            var goldMaterial = new THREE.MeshStandardMaterial({
                color: 0xffaa00, roughness: 0.2, metalness: 1.0
            });

            var self = this;
            if (typeof THREE !== 'undefined' && THREE.GLTFLoader) {
                var loader = new THREE.GLTFLoader();
                loader.load(this.glbPath, function (gltf) {
                    var model = gltf.scene;
                    model.scale.set(0.4, 0.4, 0.4);
                    var box = new THREE.Box3().setFromObject(model);
                    var center = box.getCenter(new THREE.Vector3());
                    model.position.x = -center.x;
                    model.position.y = -center.y;
                    model.position.z = -center.z;
                    model.traverse(function (child) {
                        if (child.isMesh) {
                            child.material = goldMaterial;
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                    self.group.add(model);
                }, undefined, function () {
                    self._addFallbackShape(goldMaterial);
                });
            } else {
                this._addFallbackShape(goldMaterial);
            }

            this._glowTexture = this._createGlowTexture(255, 210, 100);
            this.createParticles();
            this.clock = new THREE.Clock();

            this._onResize = function () {
                if (!self.camera || !self.renderer) return;
                self.camera.aspect = window.innerWidth / window.innerHeight;
                self.camera.updateProjectionMatrix();
                self.renderer.setSize(window.innerWidth, window.innerHeight);
            };
            window.addEventListener('resize', this._onResize);
        },

        _addFallbackShape: function (material) {
            this.group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 1), material));
            var wireMat = new THREE.MeshBasicMaterial({
                color: 0xffcc44, wireframe: true, transparent: true, opacity: 0.25
            });
            this.group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(2.8, 1), wireMat));
        },

        createParticles: function () {
            var count = 500;
            var pos = new Float32Array(count * 3);
            for (var i = 0; i < count; i++) {
                var theta = Math.random() * Math.PI * 2;
                var phi = Math.acos(2 * Math.random() - 1);
                var r = 3 + Math.random() * 14;
                pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
                pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
                pos[i * 3 + 2] = r * Math.cos(phi);
            }
            var geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            this.particles = new THREE.Points(geo,
                new THREE.PointsMaterial({
                    size: 0.18, map: this._glowTexture,
                    transparent: true, opacity: 0.9,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false, sizeAttenuation: true
                })
            );
            this.scene.add(this.particles);
        },

        triggerWave: function (delay) {
            var self = this;
            setTimeout(function () {
                if (!self.scene) return;

                // One clean expanding ring facing the camera
                var ring = new THREE.Mesh(
                    new THREE.RingGeometry(0.8, 1.0, 64),
                    new THREE.MeshBasicMaterial({
                        color: 0xffcc44, transparent: true, opacity: 0,
                        side: THREE.DoubleSide, blending: THREE.AdditiveBlending
                    })
                );
                self.scene.add(ring);
                self.waves.push({ mesh: ring, age: 0, speed: 0.8, expand: 6, maxOp: 0.6 });

                // A few fast sparks
                for (var i = 0; i < 12; i++) {
                    var angle = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
                    var speed = 3 + Math.random() * 2;
                    var spark = new THREE.Mesh(
                        new THREE.SphereGeometry(0.03, 6, 6),
                        new THREE.MeshBasicMaterial({
                            color: 0xffdd66, transparent: true, opacity: 1,
                            blending: THREE.AdditiveBlending
                        })
                    );
                    self.scene.add(spark);
                    self.sparks.push({
                        mesh: spark, age: 0,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        vz: 0,
                        life: 0.5 + Math.random() * 0.3,
                        drag: 0.94
                    });
                }
            }, delay);
        },

        animate: function (now) {
            if (!this.active) return;
            this.frameId = requestAnimationFrame(this._boundAnimate);
            var frameInterval = (window.AoLPerformance || {}).frameIntervalMs || 16;
            if (this._lastFrame && now - this._lastFrame < frameInterval) return;
            this._lastFrame = now;
            if (!this.scene || !this.camera || !this.group || !this.clock) return;

            var dt = Math.min(this.clock.getDelta(), 0.05);
            var t = this.clock.getElapsedTime();

            // Spin with very gentle bob
            this.group.rotation.y += 2.2 * dt;
            this.group.rotation.z = 0.0;
            this.group.position.y = Math.sin(t * 0.8) * 0.12;

            var pulse = 1 + Math.sin(t * 3) * 0.012;
            if (!this._isScalingIn) {
                this.group.scale.set(pulse, pulse, pulse);
            }

            // Waves (torus rings + energy pulses)
            for (var i = this.waves.length - 1; i >= 0; i--) {
                var w = this.waves[i];
                w.age += dt * w.speed;
                var s = 1 + w.age * w.expand;
                w.mesh.scale.set(s, s, s);

                var fadeIn = Math.min(1, w.age / 0.08);
                var fadeOut = Math.max(0, 1 - Math.pow(w.age * 0.7, 2));
                w.mesh.material.opacity = w.maxOp * fadeIn * fadeOut;

                if (w.age >= 1.8) {
                    this.scene.remove(w.mesh);
                    w.mesh.geometry.dispose();
                    w.mesh.material.dispose();
                    this.waves.splice(i, 1);
                }
            }

            // Sparks
            for (var j = this.sparks.length - 1; j >= 0; j--) {
                var sp = this.sparks[j];
                sp.age += dt;
                sp.mesh.position.x += sp.vx * dt;
                sp.mesh.position.y += sp.vy * dt;
                sp.mesh.position.z += sp.vz * dt;
                sp.vx *= sp.drag; sp.vy *= sp.drag; sp.vz *= sp.drag;

                var life = 1 - sp.age / sp.life;
                sp.mesh.material.opacity = Math.max(0, life * life * life);
                var sc = 0.3 + life * 0.7;
                sp.mesh.scale.set(sc, sc, sc);

                if (sp.age >= sp.life) {
                    this.scene.remove(sp.mesh);
                    sp.mesh.geometry.dispose();
                    sp.mesh.material.dispose();
                    this.sparks.splice(j, 1);
                }
            }

            // Particles gentle orbit + subtle drift
            if (this.particles) {
                this.particles.rotation.y = t * 0.018;
                this.particles.rotation.x = t * 0.005;
                var positions = this.particles.geometry.attributes.position.array;
                for (var k = 0; k < positions.length; k += 3) {
                    positions[k + 1] += Math.sin(t * 0.5 + k * 0.1) * 0.0008;
                }
                this.particles.geometry.attributes.position.needsUpdate = true;
            }

            this.renderer.render(this.scene, this.camera);
        },

        destroy: function () {
            this.active = false;
            this._isScalingIn = false;
            this._lastFrame = 0;
            if (this.frameId) cancelAnimationFrame(this.frameId);
            if (this._onResize) window.removeEventListener('resize', this._onResize);
            var i;
            for (i = 0; i < this.waves.length; i++) {
                var w = this.waves[i];
                if (w.mesh && this.scene) { this.scene.remove(w.mesh); w.mesh.geometry.dispose(); w.mesh.material.dispose(); }
            }
            for (i = 0; i < this.sparks.length; i++) {
                var sp = this.sparks[i];
                if (sp.mesh && this.scene) { this.scene.remove(sp.mesh); sp.mesh.geometry.dispose(); sp.mesh.material.dispose(); }
            }
            if (this._glowTexture) { this._glowTexture.dispose(); this._glowTexture = null; }
            if (this.group) window.AoLDisposeObject3D(this.group);
            if (this.particles) window.AoLDisposeObject3D(this.particles);
            if (this.renderer) {
                this.renderer.dispose();
                if (this.renderer.domElement && this.renderer.domElement.parentNode) this.renderer.domElement.remove();
            }
            this.scene = null; this.camera = null; this.renderer = null;
            this.group = null; this.particles = null;
            this.waves = []; this.sparks = []; this.clock = null;
        }
    },

    showEraUnlock: function (containerId, colorHex) {
        var era = this._era3d;
        if (era.scene) era.destroy();

        era.init(containerId);
        era.active = true;
        era._boundAnimate = era.animate.bind(era);
        if (era.clock) era.clock.start();

        if (era.group) {
            era.group.scale.set(0, 0, 0);
            era._isScalingIn = true;
            var startTime = performance.now();
            var scaleIn = function (now) {
                var elapsed = (now - startTime) / 1000;
                if (elapsed < 1.2) {
                    var t = elapsed / 1.2;
                    var s = 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
                    era.group.scale.set(s, s, s);
                    requestAnimationFrame(scaleIn);
                } else {
                    era.group.scale.set(1, 1, 1);
                    era._isScalingIn = false;
                }
            };
            requestAnimationFrame(scaleIn);
        }

        era._boundAnimate(performance.now());
        era.triggerWave(200);
        era.triggerWave(700);
        era.triggerWave(1300);
    },

    hideEraUnlock: function () {
        var overlay = document.querySelector('.era-unlock-overlay');
        if (overlay) {
            overlay.style.transition = 'opacity 0.8s ease-out';
            overlay.style.opacity = '0';
            var self = this;
            setTimeout(function () { self._era3d.destroy(); }, 850);
        } else {
            this._era3d.destroy();
        }
    },

    dispose: function () {
        this.deactivateMap();
        this.stopParticles();
        if (this._era3d && this._era3d.scene) this._era3d.destroy();
    }
};

// ─── AUDIO MANAGER ──────────────────────────────────────────────────────────

window.AgeOfLibertyAudio = {
    _ctx: null,
    _musicEl: null,
    _musicVolume: 0.4,
    _sfxVolume: 0.6,
    _muted: false,
    _currentTrack: 0,
    _tracks: [
        'assets/music/track1.mp3',
        'assets/music/track2.mp3',
    ],

    init: function () {
        if (this._ctx) return;
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();

        // Restore saved preferences
        var savedMusic = localStorage.getItem('aol_music_vol');
        var savedSfx = localStorage.getItem('aol_sfx_vol');
        if (savedMusic !== null) this._musicVolume = parseFloat(savedMusic);
        if (savedSfx !== null) this._sfxVolume = parseFloat(savedSfx);

        // Create music element
        this._musicEl = document.createElement('audio');
        this._musicEl.loop = false;
        this._musicEl.volume = this._musicVolume;
        var self = this;
        this._musicEl.addEventListener('ended', function () {
            self._currentTrack = (self._currentTrack + 1) % self._tracks.length;
            self.playMusic();
        });
    },

    // ── Music ───────────────────────────────────────────────────────────────

    playMusic: function () {
        if (!this._musicEl) this.init();
        var src = this._tracks[this._currentTrack];
        this._musicEl.src = src;
        this._musicEl.volume = this._musicVolume;
        this._musicEl.play().catch(function () { /* autoplay blocked, will start on interaction */ });
    },

    stopMusic: function () {
        if (this._musicEl) {
            this._musicEl.pause();
            this._musicEl.currentTime = 0;
        }
    },

    setMusicVolume: function (vol) {
        this._musicVolume = Math.max(0, Math.min(1, vol));
        if (this._musicEl) this._musicEl.volume = this._musicVolume;
        localStorage.setItem('aol_music_vol', this._musicVolume);
    },

    setSfxVolume: function (vol) {
        this._sfxVolume = Math.max(0, Math.min(1, vol));
        localStorage.setItem('aol_sfx_vol', this._sfxVolume);
    },

    getMusicVolume: function () { return this._musicVolume; },
    getSfxVolume: function () { return this._sfxVolume; },

    // ── Procedural SFX ──────────────────────────────────────────────────────

    _playTone: function (freq, duration, type, gainVal, rampDown) {
        if (!this._ctx || this._sfxVolume <= 0) return;
        if (this._ctx.state === 'suspended') this._ctx.resume();
        var osc = this._ctx.createOscillator();
        var gain = this._ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(gainVal * this._sfxVolume, this._ctx.currentTime);
        if (rampDown !== false) {
            gain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + duration);
        }
        osc.connect(gain);
        gain.connect(this._ctx.destination);
        osc.start();
        osc.stop(this._ctx.currentTime + duration);
    },

    // Build confirmed — ascending two-note chime
    sfxBuild: function () {
        this._playTone(523, 0.12, 'sine', 0.3);     // C5
        var self = this;
        setTimeout(function () {
            self._playTone(659, 0.18, 'sine', 0.25);  // E5
        }, 80);
    },

    // Atom selected — soft click
    sfxTap: function () {
        this._playTone(800, 0.06, 'sine', 0.15);
    },

    // Scenario arrives — dramatic low sting
    sfxScenario: function () {
        this._playTone(220, 0.4, 'sawtooth', 0.15);   // A3 sawtooth
        var self = this;
        setTimeout(function () {
            self._playTone(165, 0.5, 'sawtooth', 0.12); // E3
        }, 150);
    },

    // Choice made — confirmation tone
    sfxChoice: function () {
        this._playTone(440, 0.1, 'sine', 0.2);
        var self = this;
        setTimeout(function () {
            self._playTone(554, 0.1, 'sine', 0.18);   // C#5
        }, 60);
        setTimeout(function () {
            self._playTone(659, 0.15, 'sine', 0.15);  // E5
        }, 120);
    },

    // Cascade ripple — descending tone sweep
    sfxCascade: function () {
        if (!this._ctx || this._sfxVolume <= 0) return;
        if (this._ctx.state === 'suspended') this._ctx.resume();
        var osc = this._ctx.createOscillator();
        var gain = this._ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this._ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, this._ctx.currentTime + 0.6);
        gain.gain.setValueAtTime(0.2 * this._sfxVolume, this._ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + 0.7);
        osc.connect(gain);
        gain.connect(this._ctx.destination);
        osc.start();
        osc.stop(this._ctx.currentTime + 0.7);
    },

    // Era unlock — triumphant fanfare
    sfxEraUnlock: function () {
        var notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
        var self = this;
        notes.forEach(function (freq, i) {
            setTimeout(function () {
                self._playTone(freq, 0.3, 'sine', 0.25);
            }, i * 120);
        });
        // Low foundation
        setTimeout(function () {
            self._playTone(262, 0.8, 'triangle', 0.15); // C4
        }, 50);
    },

    // Gold tick — very subtle coin clink
    sfxGold: function () {
        this._playTone(2400, 0.04, 'sine', 0.06);
        var self = this;
        setTimeout(function () {
            self._playTone(3200, 0.03, 'sine', 0.04);
        }, 25);
    },

    // Toast / feedback notification
    sfxNotify: function () {
        this._playTone(660, 0.08, 'sine', 0.15);
        var self = this;
        setTimeout(function () {
            self._playTone(880, 0.12, 'sine', 0.12);
        }, 60);
    }
};
