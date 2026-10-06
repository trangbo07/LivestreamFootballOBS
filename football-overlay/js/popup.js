/* =====================================================================
 *  POPUP.JS
 *   - Popup  : GOAL / YELLOW_CARD / RED_CARD / SUBSTITUTION /
 *              MATCH_START / HALF_TIME / FULL_TIME / CUSTOM  (có hàng đợi)
 *   - LowerThird, Donation, Social
 * ===================================================================== */
(function () {
    'use strict';
    const { esc } = window.Util;

    const ICON_BALL = '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#fff"/><path d="M20 12.5l6.6 4.8-2.5 7.8h-8.2l-2.5-7.8z" fill="#0b1a4a"/><path d="M20 2v10.5M26.6 17.3l9.3-3.6M24.1 25.1l5.8 8.6M15.9 25.1l-5.8 8.6M13.4 17.3L4.1 13.7" stroke="#0b1a4a" stroke-width="2"/></svg>';
    const ICON_SWAP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h13l-4-4M20 15H7l4 4"/></svg>';
    const ARROW_OUT = '<svg class="ps-arrow" viewBox="0 0 24 24" fill="none" stroke="#ff5a6e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v16M5 13l7 7 7-7"/></svg>';
    const ARROW_IN = '<svg class="ps-arrow" viewBox="0 0 24 24" fill="none" stroke="#1fd17b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V4M5 11l7-7 7 7"/></svg>';

    const img = (src, cls = '') => src ? `<img class="${cls}" src="${esc(src)}" alt="" onerror="this.style.display='none'">` : '';

    /* ========================= STATS VIEW =========================
     * Hàng thống kê dạng "6  SÚT  3" + 2 thanh so sánh.
     * Dùng chung cho popup STATS và bảng phân tích.                    */
    const StatsView = {
        rowsHTML(rows, animate) {
            return rows.map((r, i) => {
                const h = Number(r.home) || 0, a = Number(r.away) || 0;
                const total = h + a;
                const fh = total ? h / total : 0, fa = total ? a / total : 0;
                const lead = h > a ? 'lead-home' : a > h ? 'lead-away' : '';
                const sfx = r.suffix || '';
                const delay = animate ? ` style="animation-delay:${0.25 + i * 0.07}s"` : '';
                const grow = animate ? ` style="transform:scaleX(${fh.toFixed(3)});animation:barGrow .9s var(--ease-out) ${0.4 + i * 0.07}s both"` : ` style="transform:scaleX(${fh.toFixed(3)})"`;
                const growA = animate ? ` style="transform:scaleX(${fa.toFixed(3)});animation:barGrow .9s var(--ease-out) ${0.4 + i * 0.07}s both"` : ` style="transform:scaleX(${fa.toFixed(3)})"`;
                return `<div class="st-row ${lead}" data-key="${esc(r.key || '')}"${delay}>
                    <div class="st-top"><span class="v home">${esc(h + sfx)}</span><span class="k">${esc(r.label)}</span><span class="v away">${esc(a + sfx)}</span></div>
                    <div class="st-bars"><div class="st-bar home"><i${grow}></i></div><div class="st-bar away"><i${growA}></i></div></div>
                </div>`;
            }).join('');
        },
        /** Cập nhật tại chỗ (không dựng lại DOM) để thanh trượt mượt. */
        update(container, rows) {
            const els = container.querySelectorAll('.st-row');
            if (els.length !== rows.length) { container.innerHTML = this.rowsHTML(rows, false); return; }
            rows.forEach((r, i) => {
                const el = els[i];
                const h = Number(r.home) || 0, a = Number(r.away) || 0;
                const total = h + a;
                const sfx = r.suffix || '';
                el.querySelector('.v.home').textContent = h + sfx;
                el.querySelector('.v.away').textContent = a + sfx;
                el.querySelector('.k').textContent = r.label;
                el.querySelector('.st-bar.home i').style.transform = `scaleX(${total ? (h / total).toFixed(3) : 0})`;
                el.querySelector('.st-bar.away i').style.transform = `scaleX(${total ? (a / total).toFixed(3) : 0})`;
                el.classList.toggle('lead-home', h > a);
                el.classList.toggle('lead-away', a > h);
            });
        }
    };

    /* ============================ POPUP ============================ */
    const Popup = (function () {
        let layer = null;
        let queue = [];
        let current = null;
        let timer = null;
        let durations = {};

        const BUILDERS = {
            GOAL(d) {
                const t = d.team || {};
                const h = d.home || {}, a = d.away || {};
                const isHome = d.side !== 'away';
                return `
                <div class="pg-flash"></div>
                <div class="pg-ring"></div><div class="pg-ring r2"></div>
                <div class="pg-wrap">
                    <div class="pg-head">
                        ${img(t.logo, 'pg-logo')}
                        <div class="pg-word-enter"><div class="pg-word">GOAL!</div></div>
                    </div>
                    <div class="pg-band pp-panel">
                        <div class="pg-team home ${isHome ? 'scorer' : ''}">${esc(h.short || h.name)}</div>
                        <div class="pg-score"><b class="${isHome ? 'hit' : ''}">${esc(d.score.home)}</b><i>-</i><b class="${isHome ? '' : 'hit'}">${esc(d.score.away)}</b></div>
                        <div class="pg-team away ${isHome ? '' : 'scorer'}">${esc(a.short || a.name)}</div>
                        <div class="pg-sweep"></div>
                    </div>
                    ${d.player ? `<div class="pg-strip">${ICON_BALL}<span>${esc(d.player)}</span>${d.minute ? `<span class="min">${esc(d.minute)}</span>` : ''}</div>` : ''}
                </div>`;
            },
            CARD(d, red) {
                const t = d.team || {};
                return `
                <div class="pc pp-panel">
                    <div class="pc-icon"><div class="pc-cardshape"></div></div>
                    <div class="pc-body">
                        <div class="pc-title">${red ? 'RED CARD' : 'YELLOW CARD'}</div>
                        <div class="pc-player">${esc(d.player || 'PLAYER NAME')}</div>
                        ${t.name ? `<div class="pc-team">${img(t.logo)}<span>${esc(t.short || t.name)}${d.minute ? ' · ' + esc(d.minute) : ''}</span></div>` : ''}
                    </div>
                </div>`;
            },
            YELLOW_CARD(d) { return BUILDERS.CARD(d, false); },
            RED_CARD(d) { return BUILDERS.CARD(d, true); },
            SUBSTITUTION(d) {
                const t = d.team || {};
                return `
                <div class="ps pp-panel">
                    <div class="ps-head">${ICON_SWAP}<span>SUBSTITUTION</span>
                        ${t.name ? `<span class="ps-team">${img(t.logo)}${esc(t.short || t.name)}</span>` : ''}
                    </div>
                    <div class="ps-row out"><span class="ps-tag">OUT</span>${ARROW_OUT}<span class="ps-name">${esc(d.out || 'PLAYER A')}</span></div>
                    <div class="ps-row in"><span class="ps-tag">IN</span>${ARROW_IN}<span class="ps-name">${esc(d.in || 'PLAYER B')}</span></div>
                </div>`;
            },
            STATUS(title, d, withScore) {
                const h = d.home || {}, a = d.away || {};
                let sub = '';
                if (h.name) {
                    const mid = withScore
                        ? `<span class="sc">${esc(d.score.home)} - ${esc(d.score.away)}</span>`
                        : '<span class="vs">VS</span>';
                    sub = `${img(h.logo)}<span>${esc(h.short || h.name)}</span>${mid}<span>${esc(a.short || a.name)}</span>${img(a.logo)}`;
                }
                return `
                <div class="pst">
                    <div class="pst-bar pp-panel"><i class="pst-slash l"></i><i class="pst-slash r"></i><div class="pst-title-clip"><div class="pst-title">${esc(title)}</div></div></div>
                    <div class="pst-sub">${sub}</div>
                </div>`;
            },
            MATCH_START(d) { return BUILDERS.STATUS(d.title || 'MATCH STARTING', d, false); },
            HALF_TIME(d) { return BUILDERS.STATUS(d.title || 'HALF TIME', d, true); },
            FULL_TIME(d) { return BUILDERS.STATUS(d.title || 'FULL TIME', d, true); },
            CUSTOM(d) {
                return `
                <div class="pst">
                    <div class="pst-bar pp-panel"><i class="pst-slash l"></i><i class="pst-slash r"></i><div class="pst-title-clip"><div class="pst-title">${esc(d.title || '')}</div></div></div>
                    ${d.text ? `<div class="pst-sub"><span>${esc(d.text)}</span></div>` : ''}
                </div>`;
            },
            /** d.rows = [{ key, label, home, away, suffix }] */
            STATS(d) {
                const h = d.home || {}, a = d.away || {};
                return `
                <div class="pstat pp-panel">
                    <div class="pstat-head">
                        <div class="pstat-team home">${img(h.logo)}<span>${esc(h.short || h.name)}</span></div>
                        <div class="pstat-title"><small>THỐNG KÊ TRẬN ĐẤU</small><b>${esc(d.score.home)} - ${esc(d.score.away)}</b></div>
                        <div class="pstat-team away"><span>${esc(a.short || a.name)}</span>${img(a.logo)}</div>
                    </div>
                    <div class="st-list">${StatsView.rowsHTML(d.rows || [], true)}</div>
                </div>`;
            }
        };

        function durationFor(type) {
            if (type === 'STATS') return durations.stats || 9000;
            if (type === 'GOAL') return durations.goal || 5000;
            if (type === 'YELLOW_CARD' || type === 'RED_CARD') return durations.card || 4200;
            if (type === 'SUBSTITUTION') return durations.substitution || 5000;
            return durations.status || 4200;
        }

        function next() {
            const item = queue.shift();
            if (!item) { current = null; return; }
            const build = BUILDERS[item.type] || BUILDERS.CUSTOM;
            const el = document.createElement('div');
            el.className = `pp pp-${item.type.toLowerCase().replace(/_card$/, '')}`;
            el.innerHTML = build(item.data || {});
            layer.appendChild(el);
            current = el;
            timer = setTimeout(() => dismiss(el), item.duration || durationFor(item.type));
        }

        function dismiss(el) {
            clearTimeout(timer);
            if (!el || !el.parentNode) { next(); return; }
            el.classList.add('out');
            setTimeout(() => { el.remove(); if (current === el) next(); }, 460);
        }

        return {
            init(el, cfg) { layer = el; durations = cfg || {}; },
            /** type: GOAL | YELLOW_CARD | RED_CARD | SUBSTITUTION | MATCH_START | HALF_TIME | FULL_TIME | CUSTOM */
            show(type, data, duration) {
                queue.push({ type: String(type || 'CUSTOM').toUpperCase(), data: data || {}, duration });
                if (!current) next();
            },
            /** Ẩn popup hiện tại (popup tiếp theo trong hàng đợi sẽ chạy). */
            skip() { if (current) dismiss(current); },
            clear() {
                queue = [];
                clearTimeout(timer);
                layer.innerHTML = '';
                current = null;
            }
        };
    })();

    /* ========================= LOWER THIRD ========================= */
    const LowerThird = (function () {
        let root, timer, defaultDuration = 5000;
        function show(d) {
            d = d || {};
            clearTimeout(timer);
            const apply = () => {
                root.querySelector('#lt-name').textContent = d.name || '';
                const parts = [d.role, d.team].filter(Boolean).map(esc);
                root.querySelector('#lt-sub').innerHTML = parts.join('<span class="dot">•</span>');
                root.querySelector('.lt-clip-sub').style.display = parts.length ? '' : 'none';
                root.classList.add('on');
                const dur = d.duration != null ? Number(d.duration) : defaultDuration;
                if (dur > 0) timer = setTimeout(hide, dur);
            };
            if (root.classList.contains('on')) { hide(); timer = setTimeout(apply, 750); } else apply();
        }
        function hide() { clearTimeout(timer); root.classList.remove('on'); }
        return {
            init(el, cfg) { root = el; defaultDuration = (cfg && cfg.duration != null) ? cfg.duration : 5000; },
            show, hide,
            isVisible: () => root.classList.contains('on')
        };
    })();

    /* =========================== DONATION =========================== */
    const Donation = (function () {
        let root, timer, cfg = {};
        function qrUrl(d) {
            if (d.qrImage) return d.qrImage;
            if (!d.bankId || !d.accountNo) return '';
            const acc = String(d.accountNo).replace(/\s+/g, '');
            return `https://img.vietqr.io/image/${encodeURIComponent(d.bankId)}-${encodeURIComponent(acc)}-qr_only.png` +
                `?addInfo=${encodeURIComponent(d.content || '')}&accountName=${encodeURIComponent(d.accountName || '')}`;
        }
        function render(d) {
            root.querySelector('#dn-title').textContent = d.title || 'ỦNG HỘ CHÚNG TÔI';
            const rows = [
                ['NGÂN HÀNG', d.bankName, ''],
                ['STK', d.accountNo, 'big'],
                ['CHỦ TK', d.accountName, ''],
                ['NỘI DUNG', d.content, '']
            ].filter((r) => r[1]);
            root.querySelector('#dn-info').innerHTML = rows
                .map(([k, v, c]) => `<div class="dn-row ${c}"><b>${k}</b><span>${esc(v)}</span></div>`).join('');
            const box = root.querySelector('.dn-qr');
            const im = root.querySelector('#dn-qr');
            const url = qrUrl(d);
            if (im.getAttribute('src') !== url) {
                box.classList.toggle('noimg', !url);
                im.onerror = () => box.classList.add('noimg');
                im.onload = () => box.classList.remove('noimg');
                if (url) im.src = url; else im.removeAttribute('src');
            }
        }
        function show(d, duration) {
            clearTimeout(timer);
            render(d || cfg);
            root.classList.add('on');
            const dur = duration != null ? duration : (cfg.duration || 0);
            if (dur > 0) timer = setTimeout(hide, dur);
        }
        function hide() { clearTimeout(timer); root.classList.remove('on'); }
        return {
            init(el, c) { root = el; cfg = c || {}; render(cfg); },
            show, hide, render,
            isVisible: () => root.classList.contains('on')
        };
    })();

    /* ============================ SOCIAL ============================ */
    const Social = (function () {
        let root, timer, cfg = {};
        const ICONS = {
            youtube: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M9 7.5v9l7.5-4.5z"/></svg>',
            facebook: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21z"/></svg>',
            tiktok: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M16.6 3c.3 2.2 1.6 3.6 3.9 3.8v2.6c-1.4.1-2.6-.3-3.9-1.1v5.6c0 6.4-7 8.4-9.8 3.8-1.8-3-.7-8.2 5.1-8.4v2.8c-.4.1-.9.2-1.3.3-1.3.4-2 1.3-1.8 2.8.4 2.8 5.5 3.6 5.1-1.8V3z"/></svg>',
            instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="#fff"/></svg>',
            other: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>'
        };
        const BELL = '<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 22a2.5 2.5 0 0 0 2.4-2h-4.8a2.5 2.5 0 0 0 2.4 2zm7-6V11a7 7 0 0 0-5.5-6.8V3.5a1.5 1.5 0 0 0-3 0v.7A7 7 0 0 0 5 11v5l-2 2v1h18v-1z"/></svg>';

        function show(c, duration) {
            c = c || cfg;
            clearTimeout(timer);
            const rows = (c.items || []).map((it, i) => {
                const p = ICONS[it.platform] ? it.platform : 'other';
                return `<div class="so-row" style="animation-delay:${0.35 + i * 0.12}s">
                    <div class="so-ico ${p}">${ICONS[p]}</div>
                    <div><div class="so-label">${esc(it.label || it.platform)}</div><div class="so-handle">${esc(it.handle || '')}</div></div>
                </div>`;
            }).join('');
            root.innerHTML = `<div class="so-card"><div class="so-head">${BELL}<span>${esc(c.title || 'FOLLOW US')}</span></div>${rows}</div>`;
            const dur = duration != null ? duration : (c.duration || 0);
            if (dur > 0) timer = setTimeout(hide, dur);
        }
        function hide() {
            clearTimeout(timer);
            const card = root.querySelector('.so-card');
            if (!card) return;
            card.classList.add('out');
            setTimeout(() => { if (card.parentNode) card.remove(); }, 460);
        }
        return {
            init(el, c) { root = el; cfg = c || {}; },
            show, hide,
            isVisible: () => !!root.querySelector('.so-card:not(.out)')
        };
    })();

    /* ========================== COUNTDOWN ==========================
     * Màn hình chờ trước trận: 'TRẬN ĐẤU SẮP BẮT ĐẦU' + đồng hồ đếm ngược. */
    const Countdown = (function () {
        let root, timer, cfg = null, onDone = null, last = '';
        const fmt = (ms) => {
            const s = Math.max(0, Math.ceil(ms / 1000));
            const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
            const p = (n) => String(n).padStart(2, '0');
            return (h ? h + ':' + p(m) : p(m)) + ':' + p(sec);
        };
        const digits = (t) => t.split('').map((c) => c === ':' ? ':' : '<span class="d">' + c + '</span>').join('');
        function tick() {
            if (!cfg) return;
            const left = cfg.target - Date.now();
            const t = fmt(left);
            if (t !== last) { root.querySelector('.cd-time').innerHTML = digits(t); last = t; }
            if (left <= 0 && !root.classList.contains('done')) {
                root.classList.add('done');
                root.querySelector('.cd-sub').textContent = cfg.doneText || 'TRẬN ĐẤU BẮT ĐẦU!';
                clearInterval(timer);
                setTimeout(() => { if (onDone) onDone(); }, 6000);
            }
        }
        return {
            init(el, done) { root = el; onDone = done; },
            /** c = { target(ms), title, sub, home, away } — null để ẩn */
            set(c) {
                const same = cfg && c && cfg.target === c.target && cfg.title === c.title;
                if (same) return;
                clearInterval(timer);
                cfg = c;
                last = '';
                if (!c) { root.classList.remove('on'); return; }
                const h = c.home || {}, a = c.away || {};
                root.classList.remove('done');
                root.innerHTML =
                    '<div class="cd-title">' + esc(c.title || 'TRẬN ĐẤU SẮP BẮT ĐẦU') + '</div>' +
                    '<div class="cd-teams">' +
                    '<div class="cd-team">' + img(h.logo) + '<span>' + esc(h.short || h.name || '') + '</span></div>' +
                    '<div class="cd-time"></div>' +
                    '<div class="cd-team">' + img(a.logo) + '<span>' + esc(a.short || a.name || '') + '</span></div>' +
                    '</div>' +
                    '<div class="cd-sub">' + esc(c.sub || 'ĐĂNG KÝ KÊNH & BẬT CHUÔNG ĐỂ KHÔNG BỎ LỠ') + '</div>';
                tick();
                root.classList.add('on');
                timer = setInterval(tick, 250);
            }
        };
    })();

    window.StatsView = StatsView;
    window.Countdown = Countdown;
    window.Popup = Popup;
    window.LowerThird = LowerThird;
    window.Donation = Donation;
    window.Social = Social;
})();
