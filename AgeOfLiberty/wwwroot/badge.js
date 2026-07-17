// ═══════════════════════════════════════════════════════════════════════════
// AGE OF LIBERTY — BADGE TOASTS
// Sliding notifications when badges are earned. Tron theme.
// Transform-based animation with forced reflow — reliable in MAUI WebView.
// ═══════════════════════════════════════════════════════════════════════════

window.AgeOfLibertyBadges = {

    _queue: [],
    _showing: false,

    showToast: function (atomIcon, atomName, tierName, subtitle, tierColor, tierBg, tierEmoji) {
        this._queue.push({
            atomIcon: atomIcon, atomName: atomName, tierName: tierName,
            subtitle: subtitle, tierColor: tierColor || '#d4a020',
            tierEmoji: tierEmoji || '🥉'
        });
        if (!this._showing) this._processQueue();
    },

    // Dev helper: AgeOfLibertyBadges.test() from console or debug button
    test: function () {
        this.showToast('🏠', 'House', 'Gold', 'Built 30 Houses', '#d4a020', '', '🥇');
    },

    _processQueue: function () {
        if (this._queue.length === 0) { this._showing = false; return; }
        this._showing = true;
        this._showOne(this._queue.shift());
    },

    _showOne: function (item) {
        var self = this;
        var c = item.tierColor;

        var toast = document.createElement('div');
        toast.style.cssText = [
            'position:fixed',
            'top:calc(env(safe-area-inset-top, 0px) + 64px)',
            'right:12px',
            'z-index:2000',
            'display:flex',
            'align-items:center',
            'gap:12px',
            'padding:12px 20px 12px 14px',
            'min-width:280px',
            'max-width:90vw',
            'background:rgba(7,16,30,0.92)',
            '-webkit-backdrop-filter:blur(14px)',
            'backdrop-filter:blur(14px)',
            'border:1px solid ' + c,
            'box-shadow:0 0 22px ' + c + '55, 0 8px 30px rgba(0,0,0,0.5)',
            'font-family:"Rajdhani",sans-serif',
            'transform:translateX(calc(100% + 24px))',
            'transition:transform 0.45s cubic-bezier(0.22, 1.2, 0.36, 1)',
            'pointer-events:none'
        ].join(';');

        // Left accent stripe
        var stripe = document.createElement('div');
        stripe.style.cssText = 'width:3px;height:44px;background:' + c + ';box-shadow:0 0 8px ' + c + ';flex-shrink:0;';
        toast.appendChild(stripe);

        // Atom icon in hex frame with tier emoji
        var iconWrap = document.createElement('div');
        iconWrap.style.cssText = [
            'position:relative', 'width:44px', 'height:44px',
            'display:flex', 'align-items:center', 'justify-content:center',
            'background:rgba(255,255,255,0.05)',
            'border:1px solid ' + c,
            'clip-path:polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)',
            'font-size:21px', 'flex-shrink:0'
        ].join(';');
        iconWrap.textContent = item.atomIcon || '🏗️';
        toast.appendChild(iconWrap);

        var dot = document.createElement('div');
        dot.style.cssText = 'position:absolute;bottom:6px;left:46px;font-size:13px;line-height:1;filter:drop-shadow(0 0 3px rgba(0,0,0,0.8));';
        dot.textContent = item.tierEmoji;
        toast.appendChild(dot);

        // Text
        var textWrap = document.createElement('div');
        textWrap.style.cssText = 'display:flex;flex-direction:column;gap:1px;min-width:0;';

        var title = document.createElement('div');
        title.style.cssText = [
            'font-family:"Cinzel",serif', 'font-size:14px', 'font-weight:700',
            'letter-spacing:1px', 'color:' + c,
            'white-space:nowrap', 'overflow:hidden', 'text-overflow:ellipsis',
            'text-shadow:0 0 10px ' + c + '66'
        ].join(';');
        title.textContent = (item.tierName || 'Badge') + ' Builder';
        textWrap.appendChild(title);

        var sub = document.createElement('div');
        sub.style.cssText = 'font-size:13px;font-weight:600;letter-spacing:0.5px;color:#8fa4c0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
        sub.textContent = item.subtitle || '';
        textWrap.appendChild(sub);

        toast.appendChild(textWrap);
        document.body.appendChild(toast);

        // Forced reflow, THEN animate — guarantees the transition fires
        void toast.offsetHeight;
        toast.style.transform = 'translateX(0)';

        if (window.AgeOfLibertyAudio && window.AgeOfLibertyAudio.sfxNotify) {
            try { window.AgeOfLibertyAudio.sfxNotify(); } catch (e) { }
        }

        setTimeout(function () {
            toast.style.transform = 'translateX(calc(100% + 24px))';
            setTimeout(function () {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
                setTimeout(function () { self._processQueue(); }, 250);
            }, 480);
        }, 3000);
    }
};