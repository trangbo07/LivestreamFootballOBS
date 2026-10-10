/* =====================================================================
 *  TRIBUTE.JS — bộ banner tri ân huyền thoại (hiện tại: Cristiano Ronaldo — CR7).
 *  Dữ liệu nằm trong CONFIG.tribute.
 *
 *  Cảnh (scene):
 *    matchday — màn hình giới thiệu trận đấu (toàn màn hình)
 *    legend   — hồ sơ huyền thoại: danh hiệu + cột mốc (toàn màn hình)
 *    card     — thẻ cầu thủ phía trên scoreboard
 *    goal     — màn ăn mừng bàn thắng đặc biệt (cfg.goalWord, vd. SIUUU!)
 *    ovation  — standing ovation khi rời sân
 *    thanks   — màn cảm ơn kết thúc (toàn màn hình)
 *  Badge góc phải trên: Tribute.setBadge(true/false)
 * ===================================================================== */
(function () {
    'use strict';
    const { esc } = window.Util;
    const { L } = window.I18N;

    /* ---------- Đồ hoạ ---------- */
    /** Huy hiệu ngôi sao toả sáng (vàng Al-Nassr): 24 tia + vòng tròn + ngôi sao giữa. */
    function sunSVG(cls) {
        let rays = '';
        for (let i = 0; i < 24; i++) {
            const a = (i * 15).toFixed(2);
            rays += i % 2 === 0
                ? `<path d="M60.4 33 L64 2 L67.6 33Z" transform="rotate(${a} 64 64)"/>`
                : `<path d="M61.8 33 L64 13 L66.2 33Z" transform="rotate(${a} 64 64)"/>`;
        }
        return `<svg class="${cls || ''}" viewBox="0 0 128 128" aria-hidden="true">
            <g fill="#ffc80a" stroke="#9a6a00" stroke-width=".6">${rays}</g>
            <circle cx="64" cy="64" r="29" fill="#ffc80a" stroke="#9a6a00" stroke-width="1"/>
            <circle cx="64" cy="64" r="23" fill="#0b2a5c" stroke="#2f6fe0" stroke-width="1.6"/>
            <path d="M64 46l4.4 10 10.8.9-8.2 7.1 2.5 10.6L64 69l-9.5 5.6 2.5-10.6-8.2-7.1 10.8-.9z" fill="#ffc80a"/>
        </svg>`;
    }

    /** Lưng áo sân nhà Al-Nassr (vàng, viền xanh) in tên + số (dùng khi không có ảnh). */
    function jerseySVG(name, num) {
        return `<svg class="tb-jersey" viewBox="0 0 400 440" aria-hidden="true">
            <defs>
                <linearGradient id="tbShade" x1="0" x2="1">
                    <stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset=".3" stop-color="#000" stop-opacity="0"/>
                    <stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/>
                </linearGradient>
                <clipPath id="tbShirt"><path d="M128 22 Q200 52 272 22 L382 74 L350 182 L306 164 L310 424 Q200 438 90 424 L94 164 L50 182 L18 74Z"/></clipPath>
            </defs>
            <g clip-path="url(#tbShirt)">
                <rect x="-20" width="440" height="440" fill="#ffc80a"/>
                <path d="M94 164 L306 164 L310 196 L90 196Z" fill="#2f6fe0" opacity=".18"/>
                <rect width="400" height="440" fill="url(#tbShade)"/>
                <path d="M128 22 Q200 52 272 22 L268 40 Q200 70 132 40Z" fill="#0b2a5c"/>
                <path d="M18 74 L50 182 L64 176 L34 68Z M382 74 L350 182 L336 176 L366 68Z" fill="#2f6fe0"/>
            </g>
            <text x="200" y="138" text-anchor="middle" class="tb-j-name">${esc(name)}</text>
            <text x="200" y="335" text-anchor="middle" class="tb-j-num">${esc(num)}</text>
        </svg>`;
    }

    const STAR = '<svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z"/></svg>';
    const img = (src, cls) => src ? `<img class="${cls || ''}" src="${esc(src)}" alt="" onerror="this.style.display='none'">` : '';

    function confetti(n) {
        const colors = ['#ffc80a', '#ffe066', '#2f6fe0', '#ffffff', '#9cc0ff'];
        let s = '';
        for (let i = 0; i < n; i++) {
            const left = (Math.random() * 100).toFixed(1);
            const delay = (Math.random() * 1.8).toFixed(2);
            const dur = (3 + Math.random() * 3).toFixed(2);
            const rot = Math.round(Math.random() * 360);
            const w = 8 + Math.round(Math.random() * 10);
            s += `<i style="left:${left}%;--d:${delay}s;--t:${dur}s;--r:${rot}deg;--w:${w}px;background:${colors[i % colors.length]}"></i>`;
        }
        return `<div class="tb-confetti">${s}</div>`;
    }

    /* ---------- Builders ---------- */
    let cfg = {};
    const P = () => cfg.player || {};

    function teamBlock(t, rank, side) {
        return `<div class="tb-team ${side}">
            <div class="tb-flag">${img(t.logo)}</div>
            <div class="tb-tname">${esc(t.short || t.name || '')}</div>
            ${rank ? `<div class="tb-rank">${esc(cfg.rankLabel || L('BXH FIFA'))} <b>#${esc(rank)}</b></div>` : ''}
        </div>`;
    }

    const BUILD = {
        matchday(d) {
            // Thông tin từ Live Football API (nếu có) ghi đè cấu hình tay; giữ hạng FIFA trong config
            const api = d.matchInfo || {};
            const m = Object.assign({}, cfg.match || {}, ...['competition', 'date', 'time', 'venue'].filter((k) => api[k]).map((k) => ({ [k]: api[k] })));
            if (api.sameTeams === false) { m.homeRank = null; m.awayRank = null; }
            return `<div class="tb-full tb-matchday">
                <div class="tb-bg"><div class="tb-stripes"></div>${sunSVG('tb-bgsun')}<div class="tb-vignette"></div></div>
                <div class="tb-md-top">
                    <span class="tb-chip">${esc(m.competition || L('GIAO HỮU QUỐC TẾ'))}</span>
                    <div class="tb-md-when">${esc(m.date || '')}${m.time ? ` <i></i> ${esc(m.time)}` : ''}</div>
                    ${m.venue ? `<div class="tb-md-venue">${esc(m.venue)}</div>` : ''}
                </div>
                <div class="tb-vs">
                    ${teamBlock(d.home || {}, m.homeRank, 'home')}
                    <div class="tb-vs-mid"><span>VS</span></div>
                    ${teamBlock(d.away || {}, m.awayRank, 'away')}
                </div>
                <div class="tb-ribbon">
                    <div class="tb-ribbon-num">${esc(P().number || 7)}</div>
                    <div class="tb-ribbon-txt"><small>${esc(cfg.eventTitle || L('ĐÊM TRI ÂN'))}</small><b>${esc(P().name || '')}</b></div>
                    <div class="tb-ribbon-hash">${esc(cfg.hashtag || '')}</div>
                </div>
                ${d.channel ? `<div class="tb-md-channel"><span class="tb-live-dot"></span>${L('TRỰC TIẾP TRÊN')} ${esc(L(d.channel))}</div>` : ''}
            </div>`;
        },

        legend() {
            const p = P();
            const honours = (cfg.honours || []).slice(0, 6).map((h, i) =>
                `<div class="tb-hon" style="--i:${i}">
                    <div class="tb-hon-n"><span class="tb-count" data-n="${esc(h.n)}">${esc(h.n)}</span></div>
                    <div class="tb-hon-l">${esc(h.label)}</div>
                    ${h.sub ? `<div class="tb-hon-s">${esc(h.sub)}</div>` : ''}
                </div>`).join('');
            const tl = (cfg.timeline || []).map((t, i) =>
                `<div class="tb-tl" style="--i:${i}"><b>${esc(t.year)}</b><span>${esc(t.text)}</span></div>`).join('');
            return `<div class="tb-full tb-legend">
                <div class="tb-bg"><div class="tb-stripes diag"></div><div class="tb-giant">${esc(p.number || 7)}</div><div class="tb-vignette"></div></div>
                <div class="tb-portrait">
                    ${sunSVG('tb-portrait-sun')}
                    ${p.photo ? `<img class="tb-photo" src="${esc(p.photo)}" alt="" onload="this.parentNode.classList.add('has-photo')" onerror="this.remove()">` : ''}
                    ${jerseySVG(p.shirtName || p.name || '', p.number || 7)}
                </div>
                <div class="tb-lg-info">
                    <div class="tb-kicker"><span></span>${esc(cfg.legendKicker || '')}</div>
                    <h1 class="tb-lg-name">${esc(p.fullName || p.name || '')}</h1>
                    <div class="tb-lg-sub">${esc(p.nickname || '')}${p.nickname && p.role ? ' <i></i> ' : ''}${esc(p.role || '')}</div>
                    <div class="tb-hons">${honours}</div>
                    ${tl ? `<div class="tb-tls">${tl}</div>` : ''}
                </div>
                <div class="tb-lg-hash">${esc(cfg.hashtag || '')}</div>
            </div>`;
        },

        card() {
            const p = P();
            const facts = (cfg.cardFacts || []).map((f) => `<span>${STAR}${esc(f)}</span>`).join('');
            return `<div class="tb-card">
                <div class="tb-card-num"><b>${esc(p.number || 7)}</b><small>${esc(p.badge || 'CAPTAIN')}</small></div>
                <div class="tb-card-body">
                    <div class="tb-card-name">${esc(p.name || '')}</div>
                    <div class="tb-card-role">${esc(p.role || '')}</div>
                    ${facts ? `<div class="tb-card-facts">${facts}</div>` : ''}
                </div>
                ${sunSVG('tb-card-sun')}
                <div class="tb-card-shine"></div>
            </div>`;
        },

        goal(d) {
            const p = P();
            const h = d.home || {}, a = d.away || {}, s = d.score || { home: 0, away: 0 };
            return `<div class="tb-goal">
                <div class="tb-goal-flash"></div>
                <div class="tb-goal-bars">${'<i></i>'.repeat(12)}</div>
                ${sunSVG('tb-goal-sun')}
                <div class="tb-goal-wrap">
                    <div class="tb-goal-word">${esc(cfg.goalWord || 'GOLAZO')}</div>
                    <div class="tb-goal-who">
                        <span class="tb-goal-num">${esc(p.number || 7)}</span>
                        <span class="tb-goal-name">${esc(d.player || p.name || '')}</span>
                        ${d.minute ? `<span class="tb-goal-min">${esc(d.minute)}</span>` : ''}
                    </div>
                    <div class="tb-goal-score">
                        ${img(h.logo)}<span>${esc(h.short || h.name || '')}</span>
                        <b>${esc(s.home)} - ${esc(s.away)}</b>
                        <span>${esc(a.short || a.name || '')}</span>${img(a.logo)}
                    </div>
                </div>
                ${confetti(90)}
            </div>`;
        },

        ovation(d) {
            const p = P();
            return `<div class="tb-ova">
                <div class="tb-ova-top">STANDING OVATION</div>
                <div class="tb-ova-band">
                    ${sunSVG('tb-ova-sun')}
                    <div class="tb-ova-num">${esc(p.number || 7)}</div>
                    <div class="tb-ova-txt">
                        <b>${esc(d.title || cfg.ovationTitle || '')}</b>
                        <span>${esc(d.text || cfg.ovationText || '')}</span>
                    </div>
                </div>
                ${d.in ? `<div class="tb-ova-in"><i>▲</i> ${L('VÀO SÂN:')} <b>${esc(d.in)}</b></div>` : ''}
            </div>`;
        },

        thanks() {
            const p = P();
            const t = cfg.thanks || {};
            const hons = (cfg.honours || []).slice(0, 5).map((h) => `<span><b>${esc(h.n)}</b>${esc(h.label)}</span>`).join('');
            return `<div class="tb-full tb-thanks">
                <div class="tb-bg"><div class="tb-stripes"></div>${sunSVG('tb-bgsun big')}<div class="tb-vignette"></div></div>
                ${confetti(50)}
                <div class="tb-th-wrap">
                    <div class="tb-th-num">${esc(p.number || 7)}</div>
                    <div class="tb-th-script">${esc(t.script || '')}</div>
                    <div class="tb-th-title">${esc(t.title || '')}</div>
                    ${t.sub ? `<div class="tb-th-sub">${esc(t.sub)}</div>` : ''}
                    ${hons ? `<div class="tb-th-hons">${hons}</div>` : ''}
                    <div class="tb-th-hash">${esc(cfg.hashtag || '')}</div>
                </div>
            </div>`;
        }
    };

    /* ---------- Hiển thị ---------- */
    let root, badgeEl, timer = null, outTimer = null, current = null;

    function countUp() {
        root.querySelectorAll('.tb-count').forEach((el, i) => {
            const target = parseInt(el.dataset.n, 10);
            if (!Number.isFinite(target) || target < 2) return;
            const suffix = String(el.dataset.n).replace(/^\d+/, '');   // "900+" → "+"
            const start = performance.now() + 700 + i * 120, dur = 1100;
            el.textContent = '0';
            const step = (now) => {
                const k = Math.min(1, Math.max(0, (now - start) / dur));
                el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3))) + suffix;
                if (k < 1 && root.contains(el)) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        });
    }

    function show(scene, data, duration) {
        if (!BUILD[scene]) return;
        clearTimeout(timer);
        clearTimeout(outTimer);
        root.classList.remove('out', 'on');
        root.dataset.scene = scene;
        root.innerHTML = BUILD[scene](data || {});
        void root.offsetWidth;
        root.classList.add('on');
        current = scene;
        countUp();
        const ms = duration != null ? duration : ((cfg.durations || {})[scene] || 0);
        if (ms > 0) timer = setTimeout(hide, ms);
    }

    function hide() {
        clearTimeout(timer);
        if (!current) return;
        current = null;
        root.classList.add('out');
        outTimer = setTimeout(() => {
            root.classList.remove('on', 'out');
            root.innerHTML = '';
        }, 700);
    }

    function setBadge(on) {
        if (!badgeEl) return;
        if (!badgeEl.innerHTML) {
            badgeEl.innerHTML = `${sunSVG('tb-badge-sun')}<b>${esc(P().number || 7)}</b>
                <span>${esc(cfg.hashtag || '')}<small>${esc(cfg.badgeText || '')}</small></span>`;
        }
        badgeEl.classList.toggle('on', !!on);
    }

    /** Đang hiện màn matchday → thay logo + tên đội tại chỗ (không chạy lại hiệu ứng). */
    function updateTeams(home, away) {
        if (current !== 'matchday' || !root) return;
        [['home', home], ['away', away]].forEach(([side, t]) => {
            const el = root.querySelector('.tb-team.' + side);
            if (!el || !t) return;
            const flag = el.querySelector('.tb-flag');
            const cur = flag.querySelector('img');
            if ((cur ? cur.getAttribute('src') : '') !== (t.logo || '')) flag.innerHTML = img(t.logo);
            const nm = el.querySelector('.tb-tname');
            const name = t.short || t.name || '';
            if (nm.textContent !== name) nm.textContent = name;
        });
    }

    window.Tribute = {
        init(el, badge, c) { root = el; badgeEl = badge; cfg = c || {}; },
        show, hide, setBadge, updateTeams,
        current: () => current,
        /** Tên cầu thủ có phải nhân vật được tri ân không (để tự dùng màn GOLAZO / ovation). */
        matches(name) {
            const re = cfg.matchName ? new RegExp(cfg.matchName, 'i') : null;
            return !!(re && name && re.test(String(name)));
        }
    };
})();
