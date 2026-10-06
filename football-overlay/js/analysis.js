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

    let root, win, canvas, teamEl, statsEl, possEl;
    let cfg = {};
    let on = false;
    let heatSig = '';
    let autoSide = 'home';
    let rotateTimer = null;
    let lastState = null;

    function init(el, c) {
        root = el;
        cfg = c || {};
        const cam = Object.assign({ x: 250, y: 64, w: 1100, h: 619 }, cfg.camera || {});
        root.innerHTML = `
            <div class="an-window"><div class="an-cam-label"><i></i>LIVE CAM</div></div>
            <div class="an-side">
                <div class="an-card an-heat">
                    <div class="an-head"><span class="an-h-title">HEATMAP</span><span class="an-h-team"></span></div>
                    <div class="an-pitch"><canvas width="410" height="266"></canvas>${PITCH_LINES}<div class="an-dir"></div></div>
                    <div class="an-legend"><span>${window.I18N.L('ÍT')}</span><i></i><span>${window.I18N.L('NHIỀU')}</span></div>
                </div>
                <div class="an-card an-stats">
                    <div class="an-head"><span class="an-h-title">${window.I18N.L('THỐNG KÊ')}</span><span class="an-poss"></span></div>
                    <div class="st-list"></div>
                </div>
            </div>`;
        win = root.querySelector('.an-window');
        canvas = root.querySelector('canvas');
        teamEl = root.querySelector('.an-h-team');
        statsEl = root.querySelector('.an-stats .st-list');
        possEl = root.querySelector('.an-poss');
        Object.assign(win.style, { left: cam.x + 'px', top: cam.y + 'px', width: cam.w + 'px', height: cam.h + 'px' });
        // Trạng thái tắt: khung phủ toàn màn hình (nền tối nằm ngoài khung hình)
        win.dataset.full = `translate(${-cam.x}px, ${-cam.y}px) scale(${(1920 / cam.w).toFixed(5)}, ${(1080 / cam.h).toFixed(5)})`;
        win.style.transform = win.dataset.full;
        win.style.borderRadius = '0px';
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
        const paint = () => {
            Heat.draw(canvas, pts);
            if (side === 'both') {
                teamEl.innerHTML = '<span>' + window.I18N.L('CẢ HAI ĐỘI') + '</span>';
            } else {
                const t = state[side];
                teamEl.innerHTML = `${t.logo ? `<img src="${esc(t.logo)}" alt="">` : ''}<span>${esc(t.short || t.name)}</span>`;
            }
            root.querySelector('.an-dir').textContent = side === 'away' ? window.I18N.L('◀ HƯỚNG TẤN CÔNG') : side === 'home' ? window.I18N.L('HƯỚNG TẤN CÔNG ▶') : (state.home.short || window.I18N.L('ĐỘI NHÀ')) + ' ▶';
            canvas.classList.remove('swap');
            teamEl.classList.remove('swap');
        };
        if (swapTeam && on) {
            canvas.classList.add('swap');
            teamEl.classList.add('swap');
            setTimeout(paint, 320);
        } else paint();
    }

    function startRotate() {
        clearInterval(rotateTimer);
        const sec = cfg.heatRotateSec || 10;
        rotateTimer = setInterval(() => {
            if (!on || !lastState || (lastState.heat.view || 'auto') !== 'auto') return;
            autoSide = autoSide === 'home' ? 'away' : 'home';
            renderHeat(lastState);
        }, sec * 1000);
    }

    /**
     * @param state  state overlay
     * @param rows   hàng thống kê [{key,label,home,away,suffix}]
     * @param possText chữ trạng thái kiểm soát bóng
     */
    function apply(state, rows, possText) {
        lastState = state;
        const want = state.layout === 'analysis';
        if (want !== on) {
            on = want;
            root.classList.toggle('on', on);
            win.style.transform = on ? 'none' : win.dataset.full;
            win.style.borderRadius = on ? '' : '0px';
            if (on) { renderHeat(state, true); startRotate(); } else clearInterval(rotateTimer);
        }
        if (!on) return;
        renderHeat(state);
        window.StatsView.update(statsEl, rows);
        possEl.innerHTML = possText ? `<i></i>${esc(possText)}` : '';
    }

    window.Analysis = { init, apply, Heat };
})();
