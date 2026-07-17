// ═══════════════════════════════════════════════════════════════════════════
// AGE OF LIBERTY — INTRO MUSIC
// Plays assets/music/intro.mp3 during the intro sequence with gentle fades.
// Extends AgeOfLibertyAudio without overwriting existing members —
// load AFTER any other audio script.
// ═══════════════════════════════════════════════════════════════════════════

(function () {
    var A = window.AgeOfLibertyAudio = window.AgeOfLibertyAudio || {};

    var el = null;
    var fadeTimer = null;
    var TARGET_VOL = 0.55;

    function fadeTo(vol, ms, done) {
        if (!el) { if (done) done(); return; }
        if (fadeTimer) clearInterval(fadeTimer);
        var from = el.volume;
        var start = performance.now();
        fadeTimer = setInterval(function () {
            var t = Math.min(1, (performance.now() - start) / ms);
            try { el.volume = from + (vol - from) * t; } catch (e) { }
            if (t >= 1) {
                clearInterval(fadeTimer);
                fadeTimer = null;
                if (done) done();
            }
        }, 50);
    }

    A.playIntroMusic = function () {
        try {
            if (!el) {
                el = new Audio('assets/music/intro.mp3');
                el.loop = true;
                el.preload = 'auto';
            }
            el.volume = 0;
            var p = el.play();
            if (p && p.catch) {
                p.catch(function () {
                    // Autoplay blocked (WebView gesture policy):
                    // start on the player's first touch — usually their first
                    // dialogue tap, seconds later.
                    var retry = function () {
                        el.play().then(function () { fadeTo(TARGET_VOL, 2000); }).catch(function () { });
                        document.removeEventListener('touchstart', retry);
                        document.removeEventListener('click', retry);
                    };
                    document.addEventListener('touchstart', retry, { once: true });
                    document.addEventListener('click', retry, { once: true });
                });
            }
            fadeTo(TARGET_VOL, 2500);   // rises with the awakening
        } catch (e) { }
    };

    A.stopIntroMusic = function (fadeMs) {
        fadeTo(0, fadeMs || 900, function () {
            try { el.pause(); el.currentTime = 0; } catch (e) { }
        });
    };
})();