/* =====================================================================
 *  LINEUP.JS — đội hình ra sân.
 *
 *  Dữ liệu 1 đội: { formation: "4-3-3", coach: "...", players: [...], subs: [...] }
 *  Cầu thủ: "10|NGUYỄN QUANG HẢI|QUANG HẢI"  (số|tên|tên ngắn — tên ngắn tuỳ chọn)
 *           hoặc { n: 10, name: "...", short: "..." }
 *  Thứ tự 11 người đá chính: thủ môn → hậu vệ (phải → trái) → tiền vệ → tiền đạo.
 * ===================================================================== */
(function () {
    'use strict';
    const { esc } = window.Util;

    const PITCH_SVG = `
    <svg class="lu-lines" viewBox="0 0 105 68" preserveAspectRatio="none" fill="none" stroke="#fff" stroke-width=".35">
        <rect x="1.5" y="1.5" width="102" height="65"/>
        <line x1="52.5" y1="1.5" x2="52.5" y2="66.5"/>
        <circle cx="52.5" cy="34" r="9.15"/>
        <circle cx="52.5" cy="34" r=".6" fill="#fff"/>
        <rect x="1.5" y="13.85" width="16.5" height="40.3"/>
        <rect x="1.5" y="24.85" width="5.5" height="18.3"/>
        <rect x="87" y="13.85" width="16.5" height="40.3"/>
        <rect x="98" y="24.85" width="5.5" height="18.3"/>
        <circle cx="12.5" cy="34" r=".6" fill="#fff"/>
        <circle cx="92.5" cy="34" r=".6" fill="#fff"/>
        <path d="M18 26.7a9.15 9.15 0 0 1 0 14.6M87 26.7a9.15 9.15 0 0 0 0 14.6"/>
    </svg>`;

    /* ---------- Parse ---------- */
    function parsePlayer(p) {
        if (!p) return null;
        if (typeof p === 'object') {
            return { n: p.n != null ? p.n : (p.number != null ? p.number : ''), name: p.name || '', short: p.short || '', pos: p.pos || '' };
        }
        const s = String(p).trim();
        if (!s) return null;
        if (s.includes('|')) {
            const [n, name, short, pos] = s.split('|').map((x) => x.trim());
            return { n, name: name || '', short: short || '', pos: pos || '' };
        }
        const m = s.match(/^(\d{1,3})[\s.\-:]+(.+)$/);
        return m ? { n: m[1], name: m[2].trim(), short: '', pos: '' } : { n: '', name: s, short: '', pos: '' };
    }
    const parseList = (list) => (typeof list === 'string' ? list.split(/\r?\n/) : (list || [])).map(parsePlayer).filter(Boolean);

    /** Văn bản nhiều dòng; dòng "---" hoặc "DỰ BỊ" ngăn cách đá chính / dự bị. */
    function parseText(text) {
        const players = [], subs = [];
        let target = players;
        String(text || '').split(/\r?\n/).forEach((line) => {
            const t = line.trim();
            if (!t) return;
            if (/^(-{2,}|d[ựu]\s*b[ịi]|subs?|substitutes?)\s*:?$/i.test(t)) { target = subs; return; }
            const p = parsePlayer(t);
            if (p) target.push(p);
        });
        return { players, subs };
    }

    function toText(team) {
        const line = (p) => [p.n, p.name, p.short].filter((x, i) => i < 2 || x).join('|');
        const a = (team.players || []).map(parsePlayer).filter(Boolean).map(line);
        const b = (team.subs || []).map(parsePlayer).filter(Boolean).map(line);
        return a.join('\n') + (b.length ? '\n---\n' + b.join('\n') : '');
    }

    function shortName(p) {
        if (p.short) return p.short;
        const w = String(p.name).split(/\s+/).filter(Boolean);
        return w.length >= 3 ? w.slice(-2).join(' ') : p.name;
    }

    function formationLines(f) {
        const nums = String(f || '').split(/[^0-9]+/).map(Number).filter((n) => n > 0);
        return nums.reduce((a, b) => a + b, 0) === 10 ? nums : [4, 4, 2];
    }

    /** Toạ độ (0..1) cho 11 vị trí. Đội nhà tấn công sang phải. */
    function positions(formation, side, single) {
        const L = formationLines(formation);
        const out = [{ x: single ? 0.06 : 0.055, y: 0.5 }];
        const x0 = single ? 0.22 : 0.16, x1 = single ? 0.86 : 0.445;
        L.forEach((n, li) => {
            const x = L.length === 1 ? (x0 + x1) / 2 : x0 + li * (x1 - x0) / (L.length - 1);
            const spread = n === 1 ? 0 : Math.min(0.8, 0.22 * (n - 1));
            for (let i = 0; i < n; i++) {
                const y = n === 1 ? 0.5 : 0.5 - spread / 2 + spread * i / (n - 1);
                out.push({ x, y: 1 - y });          // hậu vệ phải ở dưới (đội nhà đá sang phải)
            }
        });
        if (side === 'away' && !single) out.forEach((p) => { p.x = 1 - p.x; p.y = 1 - p.y; });
        return out;
    }

    function inkFor(hex) {
        const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
        if (!m) return '#fff';
        const n = parseInt(m[1], 16);
        const lum = 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255);
        return lum > 165 ? '#0a0f1d' : '#fff';
    }

    const teamVars = (t) => `--team:${esc(t.color || '#2ee6ff')};--team-ink:${inkFor(t.color)}`;
    const img = (src) => src ? `<img src="${esc(src)}" alt="" onerror="this.style.display='none'">` : '';

    /* ---------- Render ---------- */
    function markers(side, team, data, single, baseDelay) {
        const players = parseList(data.players).slice(0, 11);
        while (players.length < 11) players.push({ n: '', name: '' });
        const pos = positions(data.formation, side, single);
        const lines = formationLines(data.formation);
        let idx = 0;
        return players.map((p, i) => {
            const line = i === 0 ? 0 : (() => { let c = 0, k = 0; for (; k < lines.length; k++) { c += lines[k]; if (i <= c) break; } return k + 1; })();
            const d = baseDelay + 0.45 + line * 0.16 + (idx++ % 5) * 0.03;
            const { x, y } = pos[i];
            return `<div class="lu-p${i === 0 ? ' gk' : ''}" style="left:${(x * 100).toFixed(2)}%;top:${(y * 100).toFixed(2)}%;${teamVars(team)};--d:${d.toFixed(2)}s">
                <div class="lu-dot">${esc(p.n)}</div>
                ${p.name ? `<div class="lu-nm">${esc(shortName(p))}</div>` : ''}
            </div>`;
        }).join('');
    }

    function rows(list, sub, base) {
        return parseList(list).map((p, i) =>
            `<div class="lu-row${sub ? ' sub' : ''}" style="--d:${(base + i * 0.05).toFixed(2)}s">
                <span class="lu-num">${esc(p.n)}</span><span class="lu-name">${esc(p.name)}</span>${p.pos ? `<span class="lu-pos">${esc(p.pos)}</span>` : ''}
            </div>`).join('');
    }

    function listBoth(side, team, data) {
        const subs = parseList(data.subs);
        return `<div class="lu-list ${side === 'away' ? 'right' : ''}" style="${teamVars(team)}">
            <div class="lu-lh">ĐÁ CHÍNH</div>
            ${rows(data.players, false, 0.4)}
            ${subs.length ? `<div class="lu-subs">DỰ BỊ: ${subs.map((p) => `<b>${esc(p.n)}</b> ${esc(shortName(p))}`).join(' · ')}</div>` : ''}
            ${data.coach ? `<div class="lu-coach"><span>HLV</span>${esc(data.coach)}</div>` : ''}
        </div>`;
    }

    function build(view, lineups, home, away) {
        const single = view === 'home' || view === 'away';
        const H = lineups.home || {}, A = lineups.away || {};
        let head, body;
        if (single) {
            const team = view === 'home' ? home : away;
            const data = view === 'home' ? H : A;
            head = `<div class="lu-hteam">${img(team.logo)}<span>${esc(team.short || team.name)}</span><span class="lu-form">${esc(data.formation || '')}</span></div>
                <div class="lu-title"><small>ĐỘI HÌNH RA SÂN</small><b>STARTING XI</b></div>
                <div class="lu-hteam right">${data.coach ? `<span class="lu-coach-h">HLV <b>${esc(data.coach)}</b></span>` : ''}</div>`;
            body = `<div class="lu-list" style="${teamVars(team)}"><div class="lu-lh">ĐÁ CHÍNH</div>${rows(data.players, false, 0.4)}</div>
                <div class="lu-pitch-wrap"><div class="lu-pitch">${PITCH_SVG}${markers(view, team, data, true, 0)}</div></div>
                <div class="lu-list right" style="${teamVars(team)}"><div class="lu-lh">DỰ BỊ</div>${rows(data.subs, true, 0.9)}
                    ${data.coach ? `<div class="lu-coach"><span>HLV</span>${esc(data.coach)}</div>` : ''}</div>`;
        } else {
            head = `<div class="lu-hteam">${img(home.logo)}<span>${esc(home.short || home.name)}</span><span class="lu-form">${esc(H.formation || '')}</span></div>
                <div class="lu-title"><small>ĐỘI HÌNH RA SÂN</small><b>STARTING XI</b></div>
                <div class="lu-hteam right"><span class="lu-form">${esc(A.formation || '')}</span><span>${esc(away.short || away.name)}</span>${img(away.logo)}</div>`;
            body = `${listBoth('home', home, H)}
                <div class="lu-pitch-wrap"><div class="lu-pitch">${PITCH_SVG}${markers('home', home, H, false, 0)}${markers('away', away, A, false, 0.25)}</div></div>
                ${listBoth('away', away, A)}`;
        }
        return `<div class="lu-inner"><div class="lu-head">${head}</div><div class="lu-body">${body}</div></div>`;
    }

    /* ---------- Hiển thị ---------- */
    let root, current = null, swapTimer = null;

    function show(view, lineups, home, away) {
        view = view === 'home' || view === 'away' ? view : 'both';
        clearTimeout(swapTimer);
        const draw = () => {
            root.innerHTML = build(view, lineups || {}, home || {}, away || {});
            void root.offsetWidth;
            root.classList.add('on');
            current = view;
        };
        if (current && root.classList.contains('on')) {
            root.classList.remove('on');
            swapTimer = setTimeout(draw, 520);
        } else draw();
    }

    function hide() {
        clearTimeout(swapTimer);
        root.classList.remove('on');
        current = null;
    }

    window.Lineup = {
        init(el) { root = el; },
        show, hide,
        isVisible: () => !!current,
        view: () => current,
        parseText, toText, parseList
    };
})();
