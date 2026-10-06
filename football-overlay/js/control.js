/* =====================================================================
 *  CONTROL.JS — bảng điều khiển: gửi lệnh tới overlay qua Bus,
 *  nhận state từ overlay để hiển thị (tỷ số, đồng hồ, nút bật/tắt).
 * ===================================================================== */
(function () {
    'use strict';
    const C = window.CONFIG;
    const { pad } = window.Util;
    const $ = (id) => document.getElementById(id);
    const val = (id) => ($(id) ? $(id).value.trim() : '');

    let state = null;
    let filled = false;
    let lastSeen = 0;
    let evTeam = 'home';

    /* ------------------------------------------------------------------ */
    function cmd(fn, ...args) {
        window.Bus.send('cmd', { fn, args });
        flashToast(fn);
    }

    let toastTimer;
    function toast(text) {
        const t = $('toast');
        t.textContent = text;
        t.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove('show'), 1400);
    }
    function flashToast(fn) { toast('✓ ' + fn); }

    /** Đọc ảnh → dataURL (ảnh lớn được thu nhỏ để nhẹ khi đồng bộ). */
    function readImage(file, maxDim) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = () => {
                const url = reader.result;
                if (/svg/.test(file.type)) return resolve(url);
                const img = new Image();
                img.onload = () => {
                    const s = Math.min(1, maxDim / Math.max(img.width, img.height));
                    const c = document.createElement('canvas');
                    c.width = Math.round(img.width * s);
                    c.height = Math.round(img.height * s);
                    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                    resolve(c.toDataURL('image/png'));
                };
                img.onerror = reject;
                img.src = url;
            };
            reader.readAsDataURL(file);
        });
    }

    /* ------------------------------------------------------------------
     * Nút generic: data-cmd="fn" data-args='[...]'
     * ------------------------------------------------------------------ */
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-cmd]');
        if (!btn) return;
        let args = [];
        if (btn.dataset.args) { try { args = JSON.parse(btn.dataset.args); } catch (err) { /* ignore */ } }
        cmd(btn.dataset.cmd, ...args);
    });

    /* Upload ảnh → điền vào ô URL tương ứng */
    document.querySelectorAll('input[type=file][data-upload]').forEach((input) => {
        input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            if (!file) return;
            const target = input.dataset.upload;
            try {
                const data = await readImage(file, target === 'dn-qrImage' ? 600 : 480);
                $(target).value = data;
                toast('Đã tải ảnh — bấm Áp dụng / Lưu');
                // Logo kênh & logo đội: áp dụng luôn cho tiện
                if (target === 'wm-logo') cmd('setLogo', data);
                if (target === 'home-logo' || target === 'away-logo') applyTeams();
                if (target === 'dn-qrImage') saveDonation();
            } catch (err) {
                toast('Không đọc được ảnh');
            }
            input.value = '';
        });
    });

    /* ------------------------------------------------------------------
     * MATCH
     * ------------------------------------------------------------------ */
    function teamData(side) {
        return {
            name: val(`${side}-name`),
            short: val(`${side}-short`) || val(`${side}-name`),
            logo: val(`${side}-logo`),
            color: $(`${side}-color`).value
        };
    }
    function applyTeams() { cmd('setTeams', { home: teamData('home'), away: teamData('away') }); }
    $('btn-teams').onclick = applyTeams;

    $('btn-score').onclick = () => cmd('setScore', parseInt(val('score-home'), 10) || 0, parseInt(val('score-away'), 10) || 0);
    ['score-home', 'score-away'].forEach((id) => $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-score').click(); }));

    $('btn-time').onclick = () => cmd('setTime', parseInt(val('time-m'), 10) || 0, parseInt(val('time-s'), 10) || 0);
    $('btn-added').onclick = () => cmd('setAddedTime', parseInt(val('added'), 10) || 0);
    document.querySelectorAll('[data-period]').forEach((b) => {
        b.onclick = () => cmd('setPeriod', b.dataset.period);
    });
    $('btn-reset-match').onclick = () => { if (confirm('Reset tỷ số về 0-0 và đồng hồ về 00:00?')) cmd('resetMatch'); };
    $('btn-reset-all').onclick = () => { if (confirm('Xoá mọi thay đổi, quay về đúng config.js?')) { cmd('resetAll'); filled = false; } };

    /* ------------------------------------------------------------------
     * POPUPS
     * ------------------------------------------------------------------ */
    document.querySelectorAll('#ev-team button').forEach((b) => {
        b.onclick = () => {
            evTeam = b.dataset.team;
            document.querySelectorAll('#ev-team button').forEach((x) => x.classList.toggle('on', x === b));
        };
    });
    const changePeriod = () => $('ev-change').checked;

    const actions = {
        goal: (team) => cmd('goal', { team: team || evTeam, player: val('ev-player') }),
        yellow: () => cmd('yellowCard', { team: evTeam, player: val('ev-player') || 'PLAYER NAME' }),
        red: () => cmd('redCard', { team: evTeam, player: val('ev-player') || 'PLAYER NAME' }),
        sub: () => cmd('substitution', { team: evTeam, out: val('sub-out') || 'PLAYER A', in: val('sub-in') || 'PLAYER B' }),
        start: () => cmd('matchStart', { changePeriod: changePeriod() }),
        ht: () => cmd('halfTime', { changePeriod: changePeriod() }),
        ft: () => cmd('fullTime', { changePeriod: changePeriod() }),
        lowerThird: () => cmd('showLowerThird', {
            name: val('lt-name') || 'NGUYỄN VĂN A',
            role: val('lt-role'),
            team: val('lt-team'),
            duration: (parseFloat(val('lt-dur')) || 0) * 1000
        })
    };
    $('btn-goal').onclick = () => actions.goal();
    $('btn-yellow').onclick = actions.yellow;
    $('btn-red').onclick = actions.red;
    $('btn-sub').onclick = actions.sub;
    $('btn-start').onclick = actions.start;
    $('btn-ht').onclick = actions.ht;
    $('btn-ft').onclick = actions.ft;
    $('btn-custom').onclick = () => cmd('showPopup', 'CUSTOM', { title: val('cu-title') || 'THÔNG BÁO', text: val('cu-text') });

    /* ------------------------------------------------------------------
     * TICKER
     * ------------------------------------------------------------------ */
    function tickerToText(list) {
        return (list || []).map((m) => (typeof m === 'string' ? m : (m.tag ? `${m.tag}|${m.text}` : m.text))).join('\n');
    }
    $('btn-tk-apply').onclick = () => cmd('setTicker', $('tk-text').value);
    $('btn-tk-push').onclick = () => {
        const text = val('tk-breaking');
        if (!text) return toast('Nhập nội dung tin');
        cmd('showTicker', text, $('tk-tag').value);
        $('tk-breaking').value = '';
    };
    $('tk-breaking').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-tk-push').click(); });
    $('tk-speed').addEventListener('input', () => { $('tk-speed-v').textContent = $('tk-speed').value; });
    $('tk-speed').addEventListener('change', () => cmd('setTickerSpeed', Number($('tk-speed').value)));
    $('tk-dir').addEventListener('change', () => cmd('setTickerDirection', $('tk-dir').value));

    /* ------------------------------------------------------------------
     * CHAT
     * ------------------------------------------------------------------ */
    function sendChat() {
        const text = val('chat-text');
        if (!text) return;
        const msg = { user: val('chat-user') || 'admin', text };
        if ($('chat-usecolor').checked) msg.color = $('chat-color').value;
        cmd('chat', msg);
        $('chat-text').value = '';
        $('chat-text').focus();
    }
    $('btn-chat').onclick = sendChat;
    $('chat-text').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
    $('btn-fake').onclick = () => cmd('setFakeChat', !(state && state.chat.fake));
    $('chat-max').addEventListener('change', () => cmd('setChatMax', parseInt(val('chat-max'), 10) || 5));

    /* ------------------------------------------------------------------
     * LOWER THIRD
     * ------------------------------------------------------------------ */
    $('btn-lt-show').onclick = actions.lowerThird;
    $('btn-lt-preset').onclick = () => {
        const p = (C.demo && C.demo.commentator) || {};
        $('lt-name').value = p.name || '';
        $('lt-role').value = p.role || '';
        $('lt-team').value = p.team || '';
        actions.lowerThird();
    };

    /* ------------------------------------------------------------------
     * LOGO
     * ------------------------------------------------------------------ */
    $('wm-opacity').addEventListener('input', () => { $('wm-opacity-v').textContent = $('wm-opacity').value; });
    $('wm-opacity').addEventListener('change', () => cmd('setWatermarkOpacity', Number($('wm-opacity').value)));
    $('btn-wm').onclick = () => cmd('setWatermark', {
        logo: val('wm-logo'), title: val('wm-title'), line1: val('wm-line1'), line2: val('wm-line2'),
        opacity: Number($('wm-opacity').value)
    });
    $('btn-wm-clear').onclick = () => { $('wm-logo').value = ''; cmd('setLogo', ''); };

    /* ------------------------------------------------------------------
     * DONATION
     * ------------------------------------------------------------------ */
    const DN_FIELDS = ['bankName', 'bankId', 'accountNo', 'accountName', 'content', 'qrImage'];
    function donationData() {
        const d = {};
        DN_FIELDS.forEach((k) => { d[k] = val('dn-' + k); });
        return d;
    }
    function saveDonation() { cmd('setDonation', donationData()); }
    $('btn-dn-save').onclick = saveDonation;
    $('btn-dn-show').onclick = () => { saveDonation(); setTimeout(() => cmd('showDonation'), 80); };

    /* ------------------------------------------------------------------
     * DATE
     * ------------------------------------------------------------------ */
    $('btn-date').onclick = () => cmd('setDate', { day: val('dt-d'), month: val('dt-m'), year: val('dt-y') });
    $('btn-date-auto').onclick = () => cmd('setDate', null);

    /* ------------------------------------------------------------------
     * THEME
     * ------------------------------------------------------------------ */
    document.querySelectorAll('.theme-sw').forEach((b) => { b.onclick = () => cmd('setTheme', b.dataset.theme); });

    /* ------------------------------------------------------------------
     * GỌI API SERVER (YouTube / OBS) — chỉ có khi chạy qua server.js
     * ------------------------------------------------------------------ */
    const store = {
        get(k) { try { return localStorage.getItem('fo-ctl-' + k) || ''; } catch (e) { return ''; } },
        set(k, v) { try { localStorage.setItem('fo-ctl-' + k, v); } catch (e) { /* ignore */ } }
    };
    function needServer() {
        if (window.Bus.status().http) return false;
        toast('Cần mở control qua http://localhost:3000 (chạy server.js)');
        return true;
    }
    async function api(path, body) {
        try {
            const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
            return await r.json();
        } catch (e) {
            toast('Không gọi được server — server.js đã chạy chưa?');
            return null;
        }
    }

    /* ------------------------------------------------------------------
     * YOUTUBE LIVE CHAT
     * ------------------------------------------------------------------ */
    $('btn-yt-start').onclick = () => {
        if (needServer()) return;
        const source = val('yt-source');
        if (!source) return toast('Dán link livestream YouTube hoặc link kênh');
        store.set('yt-source', source);
        api('/api/youtube/start', { source, apiKey: val('yt-key') });
    };
    $('btn-yt-stop').onclick = () => { if (!needServer()) api('/api/youtube/stop'); };
    $('yt-source').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-yt-start').click(); });

    function renderYt(s) {
        const pill = $('yt-pill');
        const map = { live: ['ĐANG NHẬN CHAT', 'ok'], connecting: ['ĐANG KẾT NỐI…', 'warn'], error: ['LỖI', 'bad'], idle: ['CHƯA KẾT NỐI', ''] };
        const [txt, cls] = map[s.state] || map.idle;
        pill.textContent = txt;
        pill.className = 'pill ' + cls;
        const info = $('yt-info');
        if (s.state === 'live') {
            info.innerHTML = `<b>${Util.esc(s.title || s.videoId)}</b><br>Chế độ: ${Util.esc(s.mode || '')} · Đã hiện <b>${s.count || 0}</b> bình luận`;
        } else if (s.message) {
            info.textContent = s.message;
        }
    }

    /* ------------------------------------------------------------------
     * ĐỘI HÌNH
     * ------------------------------------------------------------------ */
    function lineupToText(L) {
        const line = (p) => [p.n, p.name].concat(p.short ? [p.short] : []).join('|');
        const a = (L.players || []).map(line);
        const b = (L.subs || []).map(line);
        return a.join('\n') + (b.length ? '\n---\n' + b.join('\n') : '');
    }
    $('btn-lu-save').onclick = () => {
        ['home', 'away'].forEach((side) => cmd('setLineup', side, {
            formation: val(`lu-${side}-form`) || '4-4-2',
            coach: val(`lu-${side}-coach`),
            text: $(`lu-${side}-text`).value
        }));
        toast('Đã lưu đội hình');
    };

    /* ------------------------------------------------------------------
     * THỐNG KÊ / KIỂM SOÁT BÓNG
     * ------------------------------------------------------------------ */
    const STAT_DEF = [['shots', 'SỐ CÚ SÚT'], ['onTarget', 'SÚT TRÚNG ĐÍCH'], ['corners', 'PHẠT GÓC'], ['fouls', 'PHẠM LỖI'],
        ['offsides', 'VIỆT VỊ'], ['yellow', 'THẺ VÀNG'], ['red', 'THẺ ĐỎ'], ['saves', 'CỨU THUA']];
    $('stat-grid').innerHTML = STAT_DEF.map(([k, label]) => {
        const side = (s) => `<div class="sg-side">
            <button class="btn sq" data-cmd="addStat" data-args='["${s}","${k}",-1]'>−</button>
            <b id="sg-${s}-${k}">0</b>
            <button class="btn sq" data-cmd="addStat" data-args='["${s}","${k}",1]'>+</button></div>`;
        return side('home') + `<div class="sg-label">${label}</div>` + side('away');
    }).join('');
    $('btn-stats-reset').onclick = () => { if (confirm('Đặt lại toàn bộ thống kê và kiểm soát bóng?')) cmd('resetStats'); };

    function possessionPct(s) {
        const p = s.possession || {};
        const live = (k) => (p[k] || 0) + (p.side === k && p.anchor ? (Date.now() - p.anchor) / 1000 : 0);
        const h = live('home'), a = live('away');
        if (h + a < 1) return { home: 50, away: 50 };
        const ph = Math.round(h / (h + a) * 100);
        return { home: ph, away: 100 - ph };
    }
    function renderPossession() {
        if (!state) return;
        const pc = possessionPct(state);
        $('poss-bar-h').style.width = pc.home + '%';
        $('poss-txt').textContent = `${state.home.short || 'NHÀ'} ${pc.home}%  —  ${pc.away}% ${state.away.short || 'KHÁCH'}`;
    }

    /* ------------------------------------------------------------------
     * HEATMAP PAD — chạm / kéo trên sân để ghi vị trí bóng
     * ------------------------------------------------------------------ */
    let heatTeam = 'home';
    let heatSig = '';
    const pending = [];
    document.querySelectorAll('#heat-team button').forEach((b) => {
        b.onclick = () => {
            heatTeam = b.dataset.team;
            document.querySelectorAll('#heat-team button').forEach((x) => x.classList.toggle('on', x === b));
            heatSig = '';
            drawPad();
        };
    });
    $('heat-view').addEventListener('change', () => cmd('setHeatView', $('heat-view').value));
    $('btn-heat-sim').onclick = () => cmd('simulateHeat', heatTeam);
    $('btn-heat-clear-team').onclick = () => cmd('clearHeat', heatTeam);

    function drawPad() {
        const c = $('heat-pad-canvas');
        const x = c.getContext('2d');
        const w = c.width, h = c.height;
        for (let i = 0; i < 12; i++) { x.fillStyle = i % 2 ? '#186f35' : '#1d7a3c'; x.fillRect(i * w / 12, 0, w / 12 + 1, h); }
        const sx = w / 105, sy = h / 68;
        x.strokeStyle = 'rgba(255,255,255,.7)';
        x.lineWidth = 2;
        const R = (a, b, cw, ch) => x.strokeRect(a * sx, b * sy, cw * sx, ch * sy);
        R(1.5, 1.5, 102, 65); R(1.5, 13.85, 16.5, 40.3); R(87, 13.85, 16.5, 40.3); R(1.5, 24.85, 5.5, 18.3); R(98, 24.85, 5.5, 18.3);
        x.beginPath(); x.moveTo(52.5 * sx, 1.5 * sy); x.lineTo(52.5 * sx, 66.5 * sy); x.stroke();
        x.beginPath(); x.ellipse(52.5 * sx, 34 * sy, 9.15 * sx, 9.15 * sy, 0, 0, Math.PI * 2); x.stroke();
        const pts = ((state && state.heat && state.heat[heatTeam]) || []).concat(pending.filter((p) => p.team === heatTeam).map((p) => p.pt));
        x.fillStyle = heatTeam === 'home' ? 'rgba(46,230,255,.6)' : 'rgba(255,61,139,.65)';
        pts.forEach((p) => { x.beginPath(); x.arc(p[0] * w, p[1] * h, 4.5, 0, Math.PI * 2); x.fill(); });
        if (state && state.heat) $('heat-count').textContent = `Nhà: ${state.heat.home.length} điểm · Khách: ${state.heat.away.length} điểm`;
    }

    (function bindPad() {
        const c = $('heat-pad-canvas');
        let painting = false, lastAdd = 0;
        const add = (e) => {
            const r = c.getBoundingClientRect();
            const pt = [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
            pending.push({ team: heatTeam, pt });
            cmd('addHeat', heatTeam, +pt[0].toFixed(3), +pt[1].toFixed(3));
            drawPad();
        };
        c.addEventListener('pointerdown', (e) => { painting = true; c.setPointerCapture(e.pointerId); add(e); lastAdd = Date.now(); });
        c.addEventListener('pointermove', (e) => { if (painting && Date.now() - lastAdd > 140) { add(e); lastAdd = Date.now(); } });
        const stop = () => { painting = false; };
        c.addEventListener('pointerup', stop);
        c.addEventListener('pointercancel', stop);
    })();

    /* ------------------------------------------------------------------
     * OBS — thu nhỏ camera thật
     * ------------------------------------------------------------------ */
    $('btn-obs-connect').onclick = () => {
        if (needServer()) return;
        store.set('obs-url', val('obs-url'));
        store.set('obs-cam-close', val('obs-cam-close'));
        store.set('obs-cam-wide', val('obs-cam-wide'));
        const body = { password: $('obs-pass').value, cameras: { close: val('obs-cam-close'), wide: val('obs-cam-wide') } };
        if (val('obs-url')) body.url = val('obs-url');
        api('/api/obs/connect', body);
    };

    /* ------------------------------------------------------------------
     * CAMERA — bố cục 2 cam, tự chuyển, scene OBS
     * ------------------------------------------------------------------ */
    const CAM_OPTS = [['', '— Không đổi —'], ['close', 'Cam cận'], ['wide', 'Toàn cảnh'], ['pip', 'PiP: toàn cảnh + cận'], ['pip2', 'PiP: cận + toàn cảnh'], ['split', 'Chia đôi']];
    document.querySelectorAll('[data-auto]').forEach((sel) => {
        sel.innerHTML = CAM_OPTS.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
        sel.addEventListener('change', () => cmd('setCamAuto', { [sel.dataset.auto]: sel.value }));
    });
    $('ca-enabled').addEventListener('change', () => cmd('setCamAuto', { enabled: $('ca-enabled').checked }));
    $('ca-hold').addEventListener('change', () => cmd('setCamAuto', { goalHold: Number(val('ca-hold')) || 8 }));

    /* Ô chọn scene cho chế độ phân tích */
    let sceneNames = [];
    function fillSceneSelects(names) {
        if (names) sceneNames = names;
        document.querySelectorAll('[data-scene-auto]').forEach((sel) => {
            const cur = (state && state.camAuto && state.camAuto[sel.dataset.sceneAuto]) || sel.value || '';
            const list = sceneNames.slice();
            if (cur && !list.includes(cur)) list.push(cur);
            const none = sel.dataset.sceneAuto === 'sceneAnalysis' ? '— Không đổi scene —' : '— Scene trước đó —';
            sel.innerHTML = '<option value="">' + none + '</option>' + list.map((n) => '<option value="' + Util.esc(n) + '">' + Util.esc(n) + '</option>').join('');
            sel.value = cur;
        });
    }
    document.querySelectorAll('[data-scene-auto]').forEach((sel) => {
        sel.addEventListener('change', () => cmd('setCamAuto', { [sel.dataset.sceneAuto]: sel.value }));
    });
    fillSceneSelects([]);

    async function loadScenes() {
        if (needServer()) return;
        const box = $('scene-list');
        try {
            const r = await fetch('/api/obs/scenes');
            const j = await r.json();
            if (!j.scenes) throw new Error(j.error || 'Chưa kết nối OBS');
            fillSceneSelects(j.scenes);
            box.innerHTML = j.scenes.map((n) => `<button class="btn${n === j.current ? ' on' : ''}" data-scene="${Util.esc(n)}">${Util.esc(n)}</button>`).join('');
            box.querySelectorAll('[data-scene]').forEach((b) => {
                b.onclick = async () => {
                    await api('/api/obs/scene', { name: b.dataset.scene });
                    box.querySelectorAll('[data-scene]').forEach((x) => x.classList.toggle('on', x === b));
                };
            });
        } catch (e) {
            box.innerHTML = `<span class="muted">${Util.esc(e.message)}</span>`;
        }
    }
    $('btn-scenes').onclick = loadScenes;
    $('btn-cam-reapply').onclick = () => { if (!needServer()) api('/api/obs/reapply'); };

    function applyCamAuto(s) {
        const A = s.camAuto || {};
        document.querySelectorAll('[data-auto]').forEach((sel) => {
            if (document.activeElement !== sel) sel.value = A[sel.dataset.auto] || '';
        });
        $('ca-enabled').checked = A.enabled !== false;
        setIfIdle('ca-hold', A.goalHold || 8);
        document.querySelectorAll('[data-scene-auto]').forEach((sel) => {
            const v = A[sel.dataset.sceneAuto] || '';
            if (document.activeElement !== sel && sel.value !== v) fillSceneSelects();
        });
    }
    $('btn-obs-disconnect').onclick = () => { if (!needServer()) api('/api/obs/disconnect'); };
    function renderObs(s) {
        const pill = $('obs-pill');
        const map = { connected: ['ĐÃ KẾT NỐI', 'ok'], connecting: ['ĐANG KẾT NỐI…', 'warn'], error: ['LỖI', 'bad'], idle: ['CHƯA KẾT NỐI', ''] };
        const [txt, cls] = map[s.state] || map.idle;
        pill.textContent = txt;
        pill.className = 'pill ' + cls;
        $('obs-info').textContent = s.message || '';
        if (s.state === 'connected' && !renderObs.loaded) { renderObs.loaded = true; loadScenes(); }
        if (s.state !== 'connected') renderObs.loaded = false;
    }

    /* ------------------------------------------------------------------
     * ĐẾM NGƯỢC
     * ------------------------------------------------------------------ */
    document.querySelectorAll('[data-cd]').forEach((b) => { b.onclick = () => { $('cd-min').value = b.dataset.cd; }; });
    $('btn-cd-start').onclick = () => cmd('startCountdown', Number(val('cd-min')) || 10, val('cd-title') || undefined);

    /** Phần state mới (theme, phân tích, thống kê, heatmap). */
    function applyExtra(s) {
        document.querySelectorAll('.theme-sw').forEach((b) => b.classList.toggle('on', b.dataset.theme === s.theme));
        document.querySelectorAll('[data-state-eq]').forEach((b) => {
            const [k, v] = b.dataset.stateEq.split(':');
            b.classList.toggle('on', getPath(s, k) === v);
        });
        if (s.stats) STAT_DEF.forEach(([k]) => ['home', 'away'].forEach((side) => {
            const el = $(`sg-${side}-${k}`);
            if (el) el.textContent = s.stats[side][k] || 0;
        }));
        $('poss-home-name').textContent = s.home.short || 'Đội nhà';
        $('poss-away-name').textContent = s.away.short || 'Đội khách';
        document.querySelectorAll('[data-poss]').forEach((b) => b.classList.toggle('on', s.possession && s.possession.side === b.dataset.poss));
        renderPossession();
        applyCamAuto(s);
        if (s.heat) {
            if (document.activeElement !== $('heat-view')) $('heat-view').value = s.heat.view || 'auto';
            const sig = heatTeam + ':' + s.heat.rev + ':' + s.heat.home.length + ':' + s.heat.away.length;
            if (sig !== heatSig) { heatSig = sig; pending.length = 0; drawPad(); }
        }
    }

    /* ------------------------------------------------------------------
     * PHÍM TẮT
     * ------------------------------------------------------------------ */
    const KEYS = {
        KeyA: () => cmd('toggleAnalysis'),
        KeyQ: () => cmd('setCamLayout', 'close'),
        KeyW: () => cmd('setCamLayout', 'wide'),
        KeyE: (e) => cmd('setCamLayout', e.shiftKey ? 'pip2' : 'pip'),
        KeyZ: () => cmd('setCamLayout', 'split'),
        KeyU: (e) => cmd('toggleLineup', e.shiftKey ? 'away' : 'both'),
        KeyK: () => cmd('showStats'),
        Digit1: () => cmd('setPossession', 'home'),
        Digit2: () => cmd('setPossession', 'away'),
        Digit0: () => cmd('setPossession', null),
        Space: () => cmd('toggleClock'),
        KeyG: (e) => actions.goal(e.shiftKey ? 'away' : evTeam),
        KeyY: actions.yellow,
        KeyR: actions.red,
        KeyS: actions.sub,
        KeyH: actions.ht,
        KeyF: actions.ft,
        KeyT: () => cmd('toggleTicker'),
        KeyC: () => cmd('toggleChat'),
        KeyL: () => cmd('toggleLowerThird', {
            name: val('lt-name') || 'NGUYỄN VĂN A', role: val('lt-role'), team: val('lt-team'),
            duration: (parseFloat(val('lt-dur')) || 0) * 1000
        }),
        KeyD: () => cmd('toggleDonation'),
        Escape: () => cmd('hidePopup')
    };
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
        const tag = (e.target && e.target.tagName) || '';
        if (/INPUT|TEXTAREA|SELECT/.test(tag)) {
            if (e.key === 'Escape') e.target.blur();
            return;
        }
        const fn = KEYS[e.code];
        if (fn) { e.preventDefault(); fn(e); }
    });

    /* ------------------------------------------------------------------
     * NHẬN STATE TỪ OVERLAY
     * ------------------------------------------------------------------ */
    function getPath(obj, path) { return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj); }

    function setIfIdle(id, value) {
        const el = $(id);
        if (!el || document.activeElement === el) return;
        el.value = value == null ? '' : value;
    }

    function fillForms(s) {
        ['home', 'away'].forEach((side) => {
            setIfIdle(`${side}-name`, s[side].name);
            setIfIdle(`${side}-short`, s[side].short);
            setIfIdle(`${side}-logo`, s[side].logo);
            if (/^#[0-9a-f]{6}$/i.test(s[side].color || '')) $(`${side}-color`).value = s[side].color;
        });
        setIfIdle('tk-text', tickerToText(s.ticker.messages));
        setIfIdle('wm-logo', s.watermark.logo);
        setIfIdle('wm-title', s.watermark.title);
        setIfIdle('wm-line1', s.watermark.line1);
        setIfIdle('wm-line2', s.watermark.line2);
        DN_FIELDS.forEach((k) => setIfIdle('dn-' + k, s.donation[k]));
        const lt = (C.lowerThird && C.lowerThird.default) || {};
        if (!val('lt-name')) { setIfIdle('lt-name', lt.name); setIfIdle('lt-role', lt.role); setIfIdle('lt-team', lt.team); }
        if (C.lowerThird && C.lowerThird.duration != null) setIfIdle('lt-dur', C.lowerThird.duration / 1000);
        const now = new Date();
        const man = s.date.manual || {};
        setIfIdle('dt-d', man.day || now.getDate());
        setIfIdle('dt-m', man.month || now.getMonth() + 1);
        setIfIdle('dt-y', man.year || now.getFullYear());
        const sc = C.shortcuts || {};
        if (!val('ev-player')) setIfIdle('ev-player', (sc.goalPlayer || {}).home || '');
        if (s.lineups) ['home', 'away'].forEach((side) => {
            const L = s.lineups[side] || {};
            setIfIdle(`lu-${side}-form`, L.formation);
            setIfIdle(`lu-${side}-coach`, L.coach);
            setIfIdle(`lu-${side}-text`, lineupToText(L));
        });
        const Y = C.youtube || {}, O = C.obs || {};
        if (!val('yt-source')) setIfIdle('yt-source', store.get('yt-source') || Y.source || '');
        if (!val('obs-url')) setIfIdle('obs-url', store.get('obs-url') || O.url || 'ws://127.0.0.1:4455');
        const CS = (C.cameras && C.cameras.sources) || {};
        if (!val('obs-cam-close')) setIfIdle('obs-cam-close', store.get('obs-cam-close') || CS.close || '');
        if (!val('obs-cam-wide')) setIfIdle('obs-cam-wide', store.get('obs-cam-wide') || CS.wide || '');
        if (!val('obs-pass') && O.password) setIfIdle('obs-pass', O.password);
        if (!val('cd-title')) setIfIdle('cd-title', (C.countdown && C.countdown.title) || '');
    }

    function applyState(s) {
        state = s;
        if (!filled) { fillForms(s); filled = true; }

        $('m-home').textContent = s.home.short || s.home.name;
        $('m-away').textContent = s.away.short || s.away.name;
        $('m-home-score').textContent = s.score.home;
        $('m-away-score').textContent = s.score.away;
        $('m-period').textContent = s.period;
        setIfIdle('score-home', s.score.home);
        setIfIdle('score-away', s.score.away);
        setIfIdle('added', s.addedTime || 0);
        setIfIdle('chat-max', s.chat.max);

        if (document.activeElement !== $('tk-speed')) { $('tk-speed').value = s.ticker.speed; $('tk-speed-v').textContent = s.ticker.speed; }
        $('tk-dir').value = s.ticker.direction;
        if (document.activeElement !== $('wm-opacity')) { $('wm-opacity').value = s.watermark.opacity; $('wm-opacity-v').textContent = s.watermark.opacity; }

        document.querySelectorAll('[data-state]').forEach((b) => b.classList.toggle('on', !!getPath(s, b.dataset.state)));
        document.querySelectorAll('[data-period]').forEach((b) => b.classList.toggle('on', b.dataset.period === s.period));
        const demo = $('btn-demo');
        demo.textContent = 'DEMO MODE: ' + (s.demo ? 'ON' : 'OFF');
        demo.classList.toggle('on', !!s.demo);
        applyExtra(s);
        renderClock();
    }

    function clockSeconds() {
        if (!state) return 0;
        const c = state.clock;
        return c.base + (c.running && c.anchor ? (Date.now() - c.anchor) / 1000 : 0);
    }

    function renderClock() {
        if (!state) return;
        const txt = { HT: 'HT', FT: 'FT', PEN: 'PEN' }[state.period];
        const s = Math.floor(clockSeconds());
        const t = txt || `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
        $('m-time').textContent = t;
        $('c-clock').textContent = t;
        $('c-clock').classList.toggle('running', state.clock.running);
        $('m-time').parentElement.classList.toggle('running', state.clock.running);
    }

    function renderStatus() {
        const st = window.Bus.status();
        const link = $('st-link');
        if (st.server) { link.textContent = 'SERVER: ĐÃ KẾT NỐI'; link.className = 'pill ok'; }
        else if (st.http) { link.textContent = 'SERVER: MẤT KẾT NỐI'; link.className = 'pill bad'; }
        else { link.textContent = 'CHẾ ĐỘ CỤC BỘ (file://)'; link.className = 'pill warn'; }

        const online = Date.now() - lastSeen < 12000;
        const ov = $('st-overlay');
        ov.textContent = online ? 'OVERLAY: ONLINE' : 'OVERLAY: CHƯA THẤY';
        ov.className = 'pill ' + (online ? 'ok' : 'bad');
    }

    window.Bus.on((msg) => {
        if (!msg.payload) return;
        if (msg.type === 'yt-status') return renderYt(msg.payload);
        if (msg.type === 'obs-status') return renderObs(msg.payload);
        if (msg.type !== 'state') return;
        lastSeen = Math.max(lastSeen, msg.ts || 0);
        applyState(msg.payload);
        renderStatus();
    });
    window.Bus.onStatus(renderStatus);
    setInterval(renderPossession, 1000);
    drawPad();

    // Hỏi overlay trạng thái hiện tại + ping định kỳ để biết overlay còn sống
    const hello = () => window.Bus.send('hello', {});
    setTimeout(hello, 300);
    setInterval(hello, 5000);
    setInterval(renderClock, 250);
    setInterval(renderStatus, 2000);
    renderStatus();
})();
