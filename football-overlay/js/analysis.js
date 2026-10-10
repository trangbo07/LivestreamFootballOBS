/* =====================================================================
 *  ANALYSIS.JS — chế độ phân tích: khung camera thu nhỏ, heatmap mini,
 *  bảng thống kê trực tiếp.
 *
 *  Heatmap: điểm (x, y) trong khoảng 0..1, đội nhà tấn công sang PHẢI.
 *  Vẽ bằng canvas 2D: cộng dồn "chổi" mờ → tô màu theo bảng nhiệt.
 *  Chỉ vẽ lại khi dữ liệu / đội đang xem thay đổi.
 * ===================================================================== */
(function () {
    'use strict';
    const { esc } = window.Util;
    const L = (s) => window.I18N.L(s);

    /* ---------------- HEATMAP ---------------- */
    const Heat = (function () {
        let brush = null, brushR = 0, palette = null;

        function makeBrush(r) {
            const c = document.createElement('canvas');
            c.width = c.height = r * 2;
            const x = c.getContext('2d');
            const g = x.createRadialGradient(r, r, 0, r, r, r);
            g.addColorStop(0, 'rgba(0,0,0,1)');
            g.addColorStop(0.5, 'rgba(0,0,0,.45)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            x.fillStyle = g;
            x.fillRect(0, 0, r * 2, r * 2);
            return c;
        }

        function makePalette() {
            const c = document.createElement('canvas');
            c.width = 256; c.height = 1;
            const x = c.getContext('2d');
            const g = x.createLinearGradient(0, 0, 256, 0);
            g.addColorStop(0.00, '#1d3bff');
            g.addColorStop(0.30, '#00e5ff');
            g.addColorStop(0.55, '#39ff7a');
            g.addColorStop(0.78, '#ffe14d');
            g.addColorStop(1.00, '#ff2d55');
            x.fillStyle = g;
            x.fillRect(0, 0, 256, 1);
            return x.getImageData(0, 0, 256, 1).data;
        }

        function draw(canvas, points) {
            const w = canvas.width, h = canvas.height;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, w, h);
            if (!points || !points.length) return;
            const r = Math.round(w * 0.075);
            if (!brush || brushR !== r) { brush = makeBrush(r); brushR = r; }
            if (!palette) palette = makePalette();

            const alpha = Math.max(0.05, Math.min(0.35, 6 / points.length));
            ctx.globalAlpha = alpha;
            points.forEach((p) => ctx.drawImage(brush, p[0] * w - r, p[1] * h - r));
            ctx.globalAlpha = 1;

            // Chuẩn hoá: điểm nóng nhất luôn là màu đỏ
            const img = ctx.getImageData(0, 0, w, h);
            const d = img.data;
            let max = 0;
            for (let i = 3; i < d.length; i += 4) if (d[i] > max) max = d[i];
            if (!max) return;
            const k = 255 / max;
            for (let i = 0; i < d.length; i += 4) {
                const a = d[i + 3];
                if (!a) continue;
                const v = Math.min(255, Math.round(a * k));
                const j = v * 4;
                d[i] = palette[j]; d[i + 1] = palette[j + 1]; d[i + 2] = palette[j + 2];
                d[i + 3] = Math.min(235, 40 + v);
            }
            ctx.putImageData(img, 0, 0);
        }

        /** Sinh dữ liệu giả lập hợp lý (dùng cho demo / nút "Mô phỏng"). */
        function simulate(side, count) {
            const pts = [];
            const attackRight = side !== 'away';
            const zones = attackRight
                ? [[0.62, 0.3, 0.12], [0.7, 0.72, 0.1], [0.5, 0.5, 0.16], [0.82, 0.5, 0.08], [0.3, 0.5, 0.12]]
                : [[0.38, 0.7, 0.12], [0.3, 0.28, 0.1], [0.5, 0.5, 0.16], [0.18, 0.5, 0.08], [0.7, 0.5, 0.12]];
            const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
            for (let i = 0; i < (count || 120); i++) {
                const z = zones[Math.floor(Math.random() * zones.length)];
                const x = Math.min(0.98, Math.max(0.02, z[0] + gauss() * z[2]));
                const y = Math.min(0.97, Math.max(0.03, z[1] + gauss() * z[2] * 1.3));
                pts.push([+x.toFixed(3), +y.toFixed(3)]);
            }
            return pts;
        }

        return { draw, simulate };
    })();

    /* ---------------- PANEL ---------------- */
    const PITCH_LINES = `<svg class="lu-lines" viewBox="0 0 105 68" preserveAspectRatio="none" fill="none" stroke="#fff" stroke-width=".45">
        <rect x="1.5" y="1.5" width="102" height="65"/><line x1="52.5" y1="1.5" x2="52.5" y2="66.5"/>
        <circle cx="52.5" cy="34" r="9.15"/><rect x="1.5" y="13.85" width="16.5" height="40.3"/>
        <rect x="87" y="13.85" width="16.5" height="40.3"/><rect x="1.5" y="24.85" width="5.5" height="18.3"/>
        <rect x="98" y="24.85" width="5.5" height="18.3"/></svg>`;

    let root, win, statsEl, possEl;
    let photoEl, photoCount, photoMin, photoCap, tlEl, tlCount;   // cột trái màn sa bàn: ảnh tự chạy + timeline
    let photoTimer = null, photoIdx = 0, photoKey = '', tlKey = '';
    let heats = [];                 // [{ card, canvas, team, dir }] — heatmap nhỏ (cột phải) + heatmap lớn
    let rects = {};                 // khung camera theo chế độ: analysis (lớn) | heatbig / trackbig (nhỏ, góc phải)
    let trackFrame, trackSrc = '';  // iframe sa bàn trực tiếp (live-football-api.com)
    let cfg = {};
    let mode = 'normal';            // normal | analysis | heatbig | trackbig
    let heatSig = '';
    let autoSide = 'home';
    let rotateTimer = null;
    let lastState = null;

    const MODES = ['analysis', 'heatbig', 'trackbig'];

    function heatCard(cls, w, h) {
        return `<div class="an-card an-heat ${cls}">
                    <div class="an-head"><span class="an-h-title">HEATMAP</span><span class="an-h-team"></span></div>
                    <div class="an-pitch"><canvas width="${w}" height="${h}"></canvas>${PITCH_LINES}<div class="an-dir"></div></div>
                    <div class="an-legend"><span>${window.I18N.L('ÍT')}</span><i></i><span>${window.I18N.L('NHIỀU')}</span></div>
                </div>`;
    }

    function init(el, c) {
        root = el;
        cfg = c || {};
        rects = {
            analysis: Object.assign({ x: 250, y: 64, w: 1100, h: 619 }, cfg.camera || {}),
            heatbig: Object.assign({ x: 1390, y: 56, w: 470, h: 264 }, cfg.cameraSmall || {})
        };
        rects.trackbig = rects.heatbig;
        const big = rects.analysis;
        root.innerHTML = `
            <div class="an-window"><div class="an-cam-label"><i></i>LIVE CAM</div></div>
            <div class="an-big" style="left:${big.x}px;top:${big.y}px;width:${big.w}px;height:${big.h}px">${heatCard('an-heat-big', 820, 531)}
                <div class="an-card an-track">
                    <div class="an-head"><span class="an-h-title">${window.I18N.L('SA BÀN TRỰC TIẾP')}</span><span class="an-track-live"><i></i>LIVE</span></div>
                    <div class="an-track-pitch"><iframe scrolling="no" tabindex="-1"></iframe></div>
                </div></div>
            <div class="an-left">
                <div class="an-card an-photos">
                    <div class="an-head"><span class="an-h-title">${L('KHOẢNH KHẮC TRẬN ĐẤU')}</span><span class="an-ph-min"></span><span class="an-ph-count"></span></div>
                    <div class="an-ph-frame"><div class="an-ph-empty">${L('Chưa có ảnh — đăng ảnh ở mục 📸 Khung ảnh trận đấu')}</div></div>
                    <div class="an-ph-cap"></div>
                </div>
                <div class="an-card an-tl">
                    <div class="an-head"><span class="an-h-title">${L('DIỄN BIẾN')}</span><span class="an-tl-count"></span></div>
                    <div class="an-tl-list"></div>
                </div>
            </div>
            <div class="an-side">
                ${heatCard('an-heat-side', 410, 266)}
                <div class="an-card an-stats">
                    <div class="an-head"><span class="an-h-title">${window.I18N.L('THỐNG KÊ')}</span><span class="an-poss"></span></div>
                    <div class="st-list"></div>
                </div>
            </div>`;
        win = root.querySelector('.an-window');
        heats = Array.from(root.querySelectorAll('.an-heat')).map((card) => ({
            card, canvas: card.querySelector('canvas'), team: card.querySelector('.an-h-team'), dir: card.querySelector('.an-dir')
        }));
        trackFrame = root.querySelector('.an-track iframe');
        statsEl = root.querySelector('.an-stats .st-list');
        possEl = root.querySelector('.an-poss');
        photoEl = root.querySelector('.an-ph-frame');
        photoCount = root.querySelector('.an-ph-count');
        photoMin = root.querySelector('.an-ph-min');
        photoCap = root.querySelector('.an-ph-cap');
        tlEl = root.querySelector('.an-tl-list');
        tlCount = root.querySelector('.an-tl-count');
        placeWindow(rects.analysis);
        win.style.transform = win.dataset.full;
        win.style.borderRadius = '0px';
    }

    /** Đặt khung camera vào rect r; trạng thái tắt = phủ toàn màn hình. */
    function placeWindow(r) {
        Object.assign(win.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
        win.dataset.full = `translate(${-r.x}px, ${-r.y}px) scale(${(1920 / r.w).toFixed(5)}, ${(1080 / r.h).toFixed(5)})`;
    }

    function heatSide(state) {
        const v = state.heat.view || 'auto';
        if (v === 'auto') return autoSide;
        return v;
    }

    function renderHeat(state, force) {
        const side = heatSide(state);
        const pts = side === 'both' ? state.heat.home.concat(state.heat.away) : (state.heat[side] || []);
        const sig = side + ':' + state.heat.home.length + ':' + state.heat.away.length + ':' + (state.heat.rev || 0);
        if (!force && sig === heatSig) return;
        const swapTeam = heatSig.split(':')[0] !== side;
        heatSig = sig;
        const paint = () => heats.forEach((h) => {
            Heat.draw(h.canvas, pts);
            if (side === 'both') {
                h.team.innerHTML = '<span>' + window.I18N.L('CẢ HAI ĐỘI') + '</span>';
            } else {
                const t = state[side];
                h.team.innerHTML = `${t.logo ? `<img src="${esc(t.logo)}" alt="">` : ''}<span>${esc(t.short || t.name)}</span>`;
            }
            h.dir.textContent = side === 'away' ? window.I18N.L('◀ HƯỚNG TẤN CÔNG') : side === 'home' ? window.I18N.L('HƯỚNG TẤN CÔNG ▶') : (state.home.short || window.I18N.L('ĐỘI NHÀ')) + ' ▶';
            h.canvas.classList.remove('swap');
            h.team.classList.remove('swap');
        });
        if (swapTeam && mode !== 'normal') {
            heats.forEach((h) => { h.canvas.classList.add('swap'); h.team.classList.add('swap'); });
            setTimeout(paint, 320);
        } else paint();
    }

    function startRotate() {
        clearInterval(rotateTimer);
        const sec = cfg.heatRotateSec || 10;
        rotateTimer = setInterval(() => {
            if (mode === 'normal' || !lastState || (lastState.heat.view || 'auto') !== 'auto') return;
            autoSide = autoSide === 'home' ? 'away' : 'home';
            renderHeat(lastState);
        }, sec * 1000);
    }

    function setMode(want) {
        const was = mode;
        mode = want;
        root.classList.toggle('on', want !== 'normal');
        root.classList.toggle('heatbig', want === 'heatbig' || want === 'trackbig');   // camera nhỏ góc phải
        root.classList.toggle('track', want === 'trackbig');
        if (want === 'normal') {
            // Khung camera phóng ra lại toàn màn hình từ vị trí hiện tại
            win.style.transform = win.dataset.full;
            win.style.borderRadius = '0px';
            clearInterval(rotateTimer);
            return;
        }
        if (was === 'normal') {
            // Đặt khung ngay (không hiệu ứng) ở dạng toàn màn hình rồi mới thu vào đúng chỗ
            win.classList.add('no-anim');
            placeWindow(rects[want]);
            win.style.transform = win.dataset.full;
            void win.offsetWidth;
            win.classList.remove('no-anim');
            startRotate();
        } else {
            placeWindow(rects[want]);       // đổi giữa 2 kiểu: khung trượt sang vị trí mới
        }
        win.style.transform = 'none';
        win.style.borderRadius = '';
        renderHeat(lastState, true);
    }

    /**
     * @param state  state overlay
     * @param rows   hàng thống kê [{key,label,home,away,suffix}]
     * @param possText chữ trạng thái kiểm soát bóng
     */
    function apply(state, rows, possText) {
        lastState = state;
        const want = MODES.includes(state.layout) ? state.layout : 'normal';
        if (want !== mode) setMode(want);
        if (mode === 'normal') return;
        if (mode === 'trackbig') {
            loadTracker(state.tracker);
            renderPhotos(state.photos || []);
            renderTimeline(state);
        } else stopPhotos();
        renderHeat(state);
        window.StatsView.update(statsEl, rows);
        possEl.innerHTML = possText ? `<i></i>${esc(possText)}` : '';
    }

    /** Chỉ nạp lại iframe khi đổi trận (giữ nguyên khi bật / tắt để không giật). */
    function loadTracker(t) {
        const src = t && t.url ? t.url : 'about:blank';
        if (src === trackSrc) return;
        trackSrc = src;
        trackFrame.src = src;
    }

    /* ---------------- ẢNH TRẬN ĐẤU TỰ CHẠY (màn sa bàn) ---------------- */
    let photos = [];
    function renderPhotos(list) {
        const key = list.map((p) => p.src + '|' + p.caption).join('\n');
        if (key === photoKey && photoTimer) return;
        const fresh = list.length && (!photos.length || list[0].src !== photos[0].src);   // vừa đăng ảnh mới → hiện ngay
        photoKey = key;
        photos = list.slice();
        if (!photos.length) {
            stopPhotos();
            photoEl.innerHTML = `<div class="an-ph-empty">${L('Chưa có ảnh — đăng ảnh ở mục 📸 Khung ảnh trận đấu')}</div>`;
            photoCount.textContent = photoMin.textContent = photoCap.textContent = '';
            return;
        }
        if (fresh || photoIdx >= photos.length || !photoTimer) showPhoto(fresh ? 0 : photoIdx % photos.length);
        if (!photoTimer) photoTimer = setInterval(() => showPhoto((photoIdx + 1) % photos.length), Math.max(3, cfg.photoRotateSec || 6) * 1000);
    }
    function showPhoto(i) {
        const p = photos[i];
        if (!p) return;
        const cur = photoEl.querySelector('.an-ph-slide:not(.leaving)');
        if (!cur || cur.dataset.src !== p.src) {
            photoEl.querySelectorAll('.an-ph-empty').forEach((el) => el.remove());
            photoEl.querySelectorAll('.an-ph-slide').forEach((el) => { el.classList.add('leaving'); setTimeout(() => el.remove(), 900); });
            photoEl.insertAdjacentHTML('beforeend', `<div class="an-ph-slide" data-src="${esc(p.src)}">
                <div class="an-ph-bg" style="background-image:url('${esc(p.src)}')"></div><img src="${esc(p.src)}" alt=""></div>`);
        }
        photoIdx = i;
        photoCount.textContent = photos.length > 1 ? `${i + 1}/${photos.length}` : '';
        photoMin.textContent = p.minute || '';
        photoCap.textContent = L(p.caption) || '';
        photoCap.style.display = p.caption ? '' : 'none';
    }
    function stopPhotos() { clearInterval(photoTimer); photoTimer = null; }

    /* ---------------- TIMELINE TÌNH HUỐNG (màn sa bàn) ---------------- */
    const TL_ICON = {
        goal: '<span class="tl-ic goal">⚽</span>', penalty_goal: '<span class="tl-ic goal">⚽</span>', own_goal: '<span class="tl-ic goal og">⚽</span>',
        yellow_card: '<span class="tl-ic card y"></span>', red_card: '<span class="tl-ic card r"></span>',
        substitution: '<span class="tl-ic sub">⇅</span>', missed_penalty: '<span class="tl-ic miss">✕</span>', var: '<span class="tl-ic var">VAR</span>'
    };
    const TL_LABEL = { goal: 'BÀN THẮNG', penalty_goal: 'PHẠT ĐỀN', own_goal: 'PHẢN LƯỚI NHÀ', yellow_card: 'THẺ VÀNG', red_card: 'THẺ ĐỎ', substitution: 'THAY NGƯỜI', missed_penalty: 'HỎNG PHẠT ĐỀN', var: 'VAR' };
    const minuteNum = (t) => { const m = String(t || '').match(/(\d+)(?:\+(\d+))?/); return m ? +m[1] + (m[2] ? +m[2] / 100 : 0) : 0; };

    function renderTimeline(state) {
        const tl = state.timeline || {};
        const list = (tl.api || tl.manual || []).slice().sort((a, b) => minuteNum(b.t) - minuteNum(a.t));
        const key = JSON.stringify([list, state.home.logo, state.away.logo, state.home.short, state.away.short]);
        if (key === tlKey) return;
        const known = new Set(Array.from(tlEl.children).map((el) => el.dataset.k));
        tlKey = key;
        tlCount.textContent = list.length ? list.length : '';
        if (!list.length) { tlEl.innerHTML = `<div class="an-tl-empty">${L('Chưa có tình huống nào')}</div>`; return; }
        tlEl.innerHTML = list.map((e) => {
            const t = state[e.side] || {};
            const k = [e.t, e.type, e.side, e.player, e.in, e.out].join('|');
            const isGoal = /goal/.test(e.type);
            const main = e.type === 'substitution'
                ? `<b class="in">▲ ${esc(e.in || '')}</b><small class="out">▼ ${esc(e.out || '')}</small>`
                : `<b>${esc(e.player || L(TL_LABEL[e.type] || ''))}${e.type === 'own_goal' && e.player && !/\(OG\)/.test(e.player) ? ' (OG)' : ''}</b>` +
                  (isGoal && e.assist ? `<small>${L('Kiến tạo')}: ${esc(e.assist)}</small>` : `<small>${L(TL_LABEL[e.type] || '')}</small>`);
            return `<div class="tl-row ${e.side}${isGoal ? ' is-goal' : ''}${known.has(k) ? '' : ' new'}" data-k="${esc(k)}">
                <span class="tl-min">${esc(e.t || '')}'</span>${TL_ICON[e.type] || ''}
                <span class="tl-txt">${main}</span>
                ${isGoal && e.score ? `<span class="tl-score">${esc(e.score)}</span>` : ''}
                ${t.logo ? `<img class="tl-logo" src="${esc(t.logo)}" alt="">` : `<span class="tl-team">${esc(t.short || '')}</span>`}
            </div>`;
        }).join('');
    }

    window.Analysis = { init, apply, Heat };
})();
