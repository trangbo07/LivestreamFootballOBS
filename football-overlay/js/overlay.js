/* =====================================================================
 *  OVERLAY.JS — lõi: state, API công khai (window.Overlay), đồng hồ,
 *  nhận lệnh từ control panel, phím tắt, DEMO MODE.
 *
 *  Ví dụ (gõ trong console hoặc gửi từ server):
 *    Overlay.setScore(1, 0)
 *    Overlay.setTime(45, 32)
 *    Overlay.startClock() / Overlay.pauseClock()
 *    Overlay.goal({ team: "home", player: "NGUYEN VAN A" })
 *    Overlay.yellowCard({ player: "PLAYER NAME", team: "away" })
 *    Overlay.redCard({ player: "PLAYER NAME" })
 *    Overlay.substitution({ out: "PLAYER A", in: "PLAYER B", team: "home" })
 *    Overlay.showTicker("BREAKING NEWS...")
 *    Overlay.showLowerThird({ name: "PLAYER NAME", role: "MIDFIELDER", team: "VIETNAM" })
 *    Overlay.showPopup("FULL_TIME")
 * ===================================================================== */
(function () {
    'use strict';
    const C = window.CONFIG;
    const { pick, hash } = window.Util;
    const { L } = window.I18N;
    /** Bản sao state với tên đội đã dịch (bản tiếng Anh) — chỉ dùng để hiển thị. */
    const view = () => window.I18N.lang === 'en' ? Object.assign({}, state, { home: window.I18N.team(state.home), away: window.I18N.team(state.away) }) : state;
    const $ = (id) => document.getElementById(id);

    const STORE_KEY = 'football-overlay-state-v1';
    const BG_KEY = 'football-overlay-previewbg';
    const PERIODS = ['1H', 'HT', '2H', 'ET1', 'ET2', 'FT', 'PEN'];
    const PERIOD_START = { '1H': 0, '2H': 45, 'ET1': 90, 'ET2': 105 };   // phút
    const PERIOD_END = { '1H': 45, '2H': 90, 'ET1': 105, 'ET2': 120 };
    const STOPPED_PERIODS = ['HT', 'FT', 'PEN'];
    const params = new URLSearchParams(location.search);
    const IN_OBS = !!window.obsstudio;
    const FINGERPRINT = String(hash(JSON.stringify(C)));

    /* ------------------------------------------------------------------
     * STATE
     * ------------------------------------------------------------------ */
    function teamFromConfig(t) {
        return { name: t.name || '', short: t.short || t.name || '', logo: t.logo || '', color: t.color || '' };
    }

    const THEMES = ['neon', 'premier', 'gold', 'classic', 'albiceleste', 'alnassr'];
    const STAT_KEYS = ['shots', 'onTarget', 'corners', 'fouls', 'offsides', 'yellow', 'red', 'saves'];
    const STAT_LABELS = {
        possession: 'KIỂM SOÁT BÓNG', shots: 'SỐ CÚ SÚT', onTarget: 'SÚT TRÚNG ĐÍCH', corners: 'PHẠT GÓC',
        fouls: 'PHẠM LỖI', offsides: 'VIỆT VỊ', yellow: 'THẺ VÀNG', red: 'THẺ ĐỎ', saves: 'CỨU THUA'
    };
    const HEAT_MAX = 400;
    const CAM_LAYOUTS = ['close', 'wide', 'pip', 'pip2', 'split', 'photo', 'photo2'];
    const PHOTO_LAYOUTS = ['photo', 'photo2'];          // cam bên trái + ảnh trận đấu bên phải

    /* Khung ảnh: vị trí ảnh đang hiện + bộ hẹn giờ trình chiếu (không lưu) */
    const PHOTO_MAX = 30;
    let photoIdx = 0;
    let slideTimer = null;
    let camBeforeSplit = 'close';
    const inPhotoSplit = () => PHOTO_LAYOUTS.includes(state.cam.layout);
    const photoIndexOf = (src) => Math.max(0, state.photos.findIndex((p) => p.src === src));
    /** Phút hiện tại để gắn lên ảnh — trước trận / nghỉ / hết trận thì để trống. */
    const photoMinute = () => (state.clock.running || ['1H', '2H', 'ET1', 'ET2'].includes(state.period) && clockSeconds() > 0) ? currentMinute() : '';

    /** Cầu thủ là nhân vật được tri ân và tính năng tự động (autoGoal / autoOvation) đang bật. */
    const tributeAuto = (key, name) => !!(C.tribute && C.tribute[key] && window.Tribute.matches(name));

    /** Báo sự kiện cho server (tự chuyển camera). */
    const emitEvent = (name) => window.Bus.send('event', { name });

    function zeroStats() {
        const o = {};
        STAT_KEYS.forEach((k) => { o[k] = 0; });
        return o;
    }

    function lineupFromConfig(side) {
        const L = (C.lineups && C.lineups[side]) || {};
        return {
            formation: L.formation || '4-4-2',
            coach: L.coach || '',
            players: window.Lineup.parseList(L.players || []),
            subs: window.Lineup.parseList(L.subs || [])
        };
    }

    function defaultState() {
        const m = C.match || {};
        const wm = C.watermark || {};
        const dt = C.date || {};
        const tk = C.ticker || {};
        const ch = C.chat || {};
        return {
            fingerprint: FINGERPRINT,
            home: teamFromConfig(C.homeTeam || {}),
            away: teamFromConfig(C.awayTeam || {}),
            score: { home: (C.score && C.score.home) || 0, away: (C.score && C.score.away) || 0 },
            clock: { running: false, base: (m.minute || 0) * 60 + (m.second || 0), anchor: null },
            period: PERIODS.includes(m.period) ? m.period : '1H',
            addedTime: m.addedTime || 0,
            live: C.live !== false,
            frame: !C.frame || C.frame.enabled !== false,
            scoreboardVisible: true,
            watermark: {
                visible: wm.enabled !== false,
                logo: wm.logo || '',
                title: wm.title || C.channelName || '',
                line1: wm.line1 || '',
                line2: wm.line2 || '',
                opacity: wm.opacity != null ? wm.opacity : 0.95
            },
            date: { visible: dt.enabled !== false, mode: dt.mode || 'auto', manual: dt.manual || null },
            ticker: {
                visible: tk.enabled !== false,
                running: true,
                speed: tk.speed || 90,
                direction: tk.direction || 'left',
                messages: (tk.messages || []).slice()
            },
            chat: { visible: ch.enabled !== false, max: ch.maxMessages || 5, fake: !!ch.fakeChat },
            donation: Object.assign({}, C.donation || {}),
            theme: THEMES.includes(C.theme) ? C.theme : 'neon',
            layout: 'normal',                        // normal | analysis | heatbig | trackbig
            tracker: { url: '', label: '' },         // sa bàn trực tiếp live-football-api.com (kiểu trackbig)
            matchInfo: null,                         // { competition, round, venue, referee, date, time } — từ Live Football API
            stats: { home: zeroStats(), away: zeroStats() },
            possession: { side: null, home: 0, away: 0, anchor: null },
            heat: { home: [], away: [], view: 'auto', rev: 0 },
            lineups: { home: lineupFromConfig('home'), away: lineupFromConfig('away') },
            countdown: null,                         // { target, title, sub }
            cam: { layout: CAM_LAYOUTS.includes((C.cameras || {}).start) ? C.cameras.start : 'close' },
            camAuto: Object.assign({ enabled: true, lineup: 'wide', goal: 'close', goalHold: 8, halfTime: 'close', fullTime: 'close', matchStart: 'wide', sceneAnalysis: '', sceneNormal: '' }, (C.cameras || {}).auto || {}),
            tributeBadge: !!(C.tribute && C.tribute.badge),
            photos: [],                              // [{ src, caption, minute }] — ảnh trận đấu đã đăng
            timeline: { api: null, manual: [] },     // tình huống trận: api = danh sách từ Live Football API (ưu tiên), manual = bấm tay
            splitPhoto: null,                        // ảnh đang hiện ở bố cục cam + ảnh
            demo: !!(C.demo && C.demo.autoStart),
            savedAt: 0
        };
    }

    /** Gộp state đã lưu với mặc định (an toàn khi thêm field mới). */
    function mergeState(saved) {
        const base = defaultState();
        Object.keys(base).forEach((k) => {
            if (saved[k] === undefined) return;
            const isObj = base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]);
            base[k] = isObj ? Object.assign(base[k], saved[k]) : saved[k];
        });
        return base;
    }

    function loadState() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
            // Nếu config.js đã bị sửa → bỏ state cũ, dùng config mới
            if (saved && saved.fingerprint === FINGERPRINT) return mergeState(saved);
        } catch (e) { /* ignore */ }
        return defaultState();
    }

    let state = loadState();
    let persistTimer = null;
    let syncWindow = true;
    let booted = false;

    function persistNow() {
        clearTimeout(persistTimer);
        try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* quota */ }
        window.Bus.send('state', state);
    }

    function commit() {
        flushPossession();
        state.savedAt = Date.now();
        renderAll();
        clearTimeout(persistTimer);
        persistTimer = setTimeout(persistNow, 120);
    }

    /* ------------------------------------------------------------------
     * CLOCK
     * ------------------------------------------------------------------ */
    function clockSeconds() {
        const c = state.clock;
        return c.base + (c.running && c.anchor ? (Date.now() - c.anchor) / 1000 : 0);
    }

    function currentMinute() {
        const m = Math.floor(clockSeconds() / 60) + 1;
        const end = PERIOD_END[state.period];
        if (end && m > end) return `${end}+${m - end}'`;
        return `${m}'`;
    }

    function tick() {
        window.Scoreboard.renderClock(clockSeconds(), state.period, state.clock.running);
    }

    /* ------------------------------------------------------------------
     * KIỂM SOÁT BÓNG — cộng dồn thời gian đội đang giữ bóng (chỉ khi
     * đồng hồ chạy). anchor = mốc bắt đầu đếm phần chưa cộng.
     * ------------------------------------------------------------------ */
    function flushPossession() {
        const p = state.possession;
        const now = Date.now();
        if (p.side && p.anchor) p[p.side] += (now - p.anchor) / 1000;
        p.anchor = (p.side && state.clock.running) ? now : null;
    }

    function possessionPct() {
        const p = state.possession;
        const live = (s) => p[s] + (p.side === s && p.anchor ? (Date.now() - p.anchor) / 1000 : 0);
        const h = live('home'), a = live('away');
        if (h + a < 1) return { home: 50, away: 50 };
        const ph = Math.round(h / (h + a) * 100);
        return { home: ph, away: 100 - ph };
    }

    function statRows(keys) {
        keys = keys || (C.analysis && C.analysis.statKeys) || ['possession', 'shots', 'onTarget', 'corners', 'fouls', 'yellow', 'red'];
        const pos = possessionPct();
        return keys.map((k) => k === 'possession'
            ? { key: k, label: L(STAT_LABELS[k]), home: pos.home, away: pos.away, suffix: '%' }
            : { key: k, label: L(STAT_LABELS[k]) || k.toUpperCase(), home: state.stats.home[k] || 0, away: state.stats.away[k] || 0 });
    }

    function possessionText() {
        const s = state.possession.side;
        if (!s) return '';
        return L('BÓNG: ') + L(state[s].short || state[s].name);
    }

    function renderAnalysis() {
        window.Analysis.apply(view(), statRows(), possessionText());
    }

    /* ------------------------------------------------------------------
     * RENDER
     * ------------------------------------------------------------------ */
    let lastWmLogo = null;
    let lastDateKey = '';
    const PERIOD_LABELS = window.I18N.deep(C.periodLabels);

    function renderWatermark() {
        const w = state.watermark;
        const el = $('watermark');
        el.classList.toggle('off', !w.visible);
        el.style.opacity = w.visible ? w.opacity : '';
        const img = $('wm-logo');
        const title = $('wm-title');
        title.textContent = L(w.title || '');
        if (w.logo !== lastWmLogo) {
            lastWmLogo = w.logo;
            if (w.logo) {
                img.style.display = '';
                title.style.display = 'none';
                img.onerror = () => { img.style.display = 'none'; title.style.display = ''; };
                img.src = w.logo;
            } else {
                img.style.display = 'none';
                img.removeAttribute('src');
                title.style.display = '';
            }
        }
        $('wm-line1').textContent = L(w.line1 || '');
        $('wm-line2').textContent = L(w.line2 || '');
    }

    function renderDate() {
        const d = state.date;
        $('datebox').classList.toggle('off', !d.visible);
        let day, month, year;
        if (d.mode === 'manual' && d.manual) {
            ({ day, month, year } = d.manual);
        } else {
            const now = new Date();
            day = now.getDate(); month = now.getMonth() + 1; year = now.getFullYear();
        }
        const key = `${day}-${month}-${year}`;
        if (key === lastDateKey) return;
        $('db-month').textContent = window.I18N.month(month);
        $('db-day').textContent = String(day).padStart(2, '0');
        $('db-year').textContent = year;
        if (lastDateKey) {
            const box = $('db-day').parentElement;
            box.classList.remove('flip');
            void box.offsetWidth;
            box.classList.add('flip');
        }
        lastDateKey = key;
    }

    function renderAll() {
        window.Scoreboard.render(view(), PERIOD_LABELS);
        tick();
        window.Ticker.apply(state.ticker);
        window.Ticker.setLiveOffset(state.live);
        window.Chat.apply(state.chat);
        window.Chat.setFake(state.chat.fake || state.demo);
        $('live').classList.toggle('off', !state.live);
        $('frame').classList.toggle('off', !state.frame);
        renderWatermark();
        renderDate();
        if (document.documentElement.dataset.theme !== state.theme) document.documentElement.dataset.theme = state.theme;
        renderAnalysis();
        window.CamFx.apply(state.cam.layout, state.layout !== 'normal', state.splitPhoto);
        window.Tribute.setBadge(state.tributeBadge);
        window.Tribute.updateTeams(view().home, view().away);   // logo / tên đội mới từ API → cập nhật màn hình trận đấu đang hiện
        window.Countdown.set(state.countdown ? Object.assign({}, state.countdown, { home: view().home, away: view().away, title: L(state.countdown.title), sub: L(state.countdown.sub) }) : null);
        const demoBtn = $('dev-demo');
        if (demoBtn) {
            demoBtn.textContent = 'DEMO MODE: ' + (state.demo ? 'ON' : 'OFF');
            demoBtn.classList.toggle('on', state.demo);
        }
    }

    /* ------------------------------------------------------------------
     * HELPERS
     * ------------------------------------------------------------------ */
    const int = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
    const sideOf = (t) => (t === 'away' || t === 2 || t === 'B') ? 'away' : 'home';

    /** team: "home" | "away" | {name, logo} | tên đội (string) | rỗng */
    function teamObj(t) {
        if (!t) return null;
        if (typeof t === 'object') return t;
        if (t === 'home' || t === 'away') return state[t];
        return { name: String(t) };
    }

    function ctx(extra) {
        const v = view();
        const out = Object.assign({ home: v.home, away: v.away, score: Object.assign({}, state.score), matchInfo: state.matchInfo }, extra || {});
        if (out.team && typeof out.team === 'object') out.team = window.I18N.team(out.team);
        return out;
    }

    /** Ghi 1 tình huống bấm tay vào timeline (có dữ liệu API thì timeline hiện danh sách API). */
    function logEvent(type, team, data) {
        const side = team === 'away' || team === state.away ? 'away' : 'home';
        const t = String((data && data.t) || '').replace(/'$/, '');
        state.timeline.manual = state.timeline.manual.concat([Object.assign({ type, side }, data, { t })]).slice(-60);
        commit();
    }

    /** Thẻ phạt tự cộng vào thống kê khi biết đội (home/away). */
    function countCard(team, key) {
        if (team !== 'home' && team !== 'away') return;
        state.stats[team][key] += 1;
        commit();
    }

    function normalizeTickerList(list) {
        if (typeof list === 'string') list = list.split(/\r?\n/);
        return (list || []).map((m) => (typeof m === 'string' ? m.trim() : m)).filter((m) => m && (typeof m === 'string' || m.text));
    }

    /* ------------------------------------------------------------------
     * PUBLIC API
     * ------------------------------------------------------------------ */
    const API = {
        /* ---------- MATCH ---------- */
        setScore(home, away) {
            state.score = { home: Math.max(0, int(home, state.score.home)), away: Math.max(0, int(away, state.score.away)) };
            commit();
        },
        addScore(team, delta) {
            const s = sideOf(team);
            state.score[s] = Math.max(0, state.score[s] + int(delta, 1));
            commit();
        },
        setTeam(team, data) {
            const s = sideOf(team);
            data = data || {};
            ['name', 'short', 'logo', 'color'].forEach((k) => { if (data[k] !== undefined) state[s][k] = data[k]; });
            if (data.name !== undefined && data.short === undefined) state[s].short = data.name;
            commit();
        },
        /** Thông tin trận (giải, vòng, sân, trọng tài, ngày, giờ) — dùng ở màn hình matchday. */
        setMatchInfo(info) { state.matchInfo = info && typeof info === 'object' ? info : null; commit(); },
        setTeams(data) {
            data = data || {};
            if (data.home) API.setTeam('home', data.home);
            if (data.away) API.setTeam('away', data.away);
        },
        swapTeams() {
            [state.home, state.away] = [state.away, state.home];
            state.score = { home: state.score.away, away: state.score.home };
            commit();
        },
        setTime(minute, second) {
            const base = Math.max(0, int(minute, 0) * 60 + int(second, 0));
            state.clock = { running: state.clock.running, base, anchor: state.clock.running ? Date.now() : null };
            commit();
        },
        adjustTime(deltaSeconds) {
            const s = Math.max(0, clockSeconds() + int(deltaSeconds, 0));
            API.setTime(0, Math.round(s));
        },
        startClock() {
            if (state.clock.running) return;
            if (state.period === 'HT') { state.period = '2H'; state.addedTime = 0; state.clock.base = PERIOD_START['2H'] * 60; }
            state.clock = { running: true, base: clockSeconds(), anchor: Date.now() };
            commit();
        },
        pauseClock() {
            if (!state.clock.running) return;
            state.clock = { running: false, base: clockSeconds(), anchor: null };
            commit();
        },
        toggleClock() { state.clock.running ? API.pauseClock() : API.startClock(); },
        resetClock() {
            state.clock = { running: false, base: (PERIOD_START[state.period] || 0) * 60, anchor: null };
            commit();
        },
        /** period: 1H | HT | 2H | ET1 | ET2 | FT | PEN.  opts: { resetTime=true, start=false } */
        setPeriod(period, opts) {
            opts = opts || {};
            const p = String(period || '').toUpperCase();
            if (!PERIODS.includes(p)) return;
            const changed = p !== state.period;
            state.period = p;
            if (changed) state.addedTime = 0;
            if (STOPPED_PERIODS.includes(p)) {
                state.clock = { running: false, base: clockSeconds(), anchor: null };
            } else if (opts.resetTime !== false && changed) {
                state.clock = { running: false, base: PERIOD_START[p] * 60, anchor: null };
            }
            commit();
            if (opts.start) API.startClock();
        },
        setAddedTime(minutes) { state.addedTime = Math.max(0, int(minutes, 0)); commit(); },
        /**
         * Dữ liệu tự động từ server (Live Football API) — ghi đè tuyệt đối, không cộng dồn.
         * d: { score:{home,away}, period, minute, running, addedTime, stats:{home:{},away:{}}, possession:{home,away} }
         */
        applyLive(d) {
            d = d || {};
            if (d.score) state.score = { home: Math.max(0, int(d.score.home, 0)), away: Math.max(0, int(d.score.away, 0)) };
            if (d.stats) ['home', 'away'].forEach((s) => STAT_KEYS.forEach((k) => {
                if (d.stats[s] && d.stats[s][k] != null) state.stats[s][k] = Math.max(0, int(d.stats[s][k], 0));
            }));
            if (Array.isArray(d.events)) state.timeline = { api: d.events.slice(-60), manual: state.timeline.manual };
            if (d.possession) state.possession = { side: null, home: Math.max(0, +d.possession.home || 0), away: Math.max(0, +d.possession.away || 0), anchor: null };
            if (d.period && PERIODS.includes(d.period) && d.period !== state.period) { state.period = d.period; state.addedTime = 0; }
            if (d.addedTime != null) state.addedTime = Math.max(0, int(d.addedTime, 0));   // phút bù giờ trên scoreboard
            const cur = clockSeconds();
            if (d.minute != null) {
                // API chỉ cho số phút → chỉ chỉnh đồng hồ khi lệch hơn 75 giây
                const target = Math.max(0, int(d.minute, 0)) * 60;
                const base = Math.abs(cur - target) > 75 ? target : cur;
                state.clock = { running: true, base, anchor: Date.now() };
            } else if (d.running === false && state.clock.running) {
                state.clock = { running: false, base: cur, anchor: null };
            }
            commit();
        },
        resetMatch() {
            const d = defaultState();
            state.score = { home: 0, away: 0 };
            state.period = '1H';
            state.addedTime = 0;
            state.clock = { running: false, base: 0, anchor: null };
            state.ticker.messages = d.ticker.messages;
            state.stats = { home: zeroStats(), away: zeroStats() };
            state.timeline = { api: null, manual: [] };
            state.possession = { side: null, home: 0, away: 0, anchor: null };
            state.heat = { home: [], away: [], view: state.heat.view, rev: (state.heat.rev || 0) + 1 };
            window.Popup.clear();
            commit();
        },
        /** Xoá mọi thứ đã lưu, quay về đúng config.js */
        resetAll() {
            stopDemo();
            state = defaultState();
            state.demo = false;
            window.Popup.clear();
            window.Donation.render(state.donation);
            commit();
        },

        /* ---------- EVENTS / POPUPS ---------- */
        goal(opts) {
            opts = opts || {};
            const side = sideOf(opts.team);
            if (opts.updateScore !== false) {
                state.score[side] += 1;
                state.stats[side].shots += 1;
                state.stats[side].onTarget += 1;
            }
            const minute = opts.minute || currentMinute();
            logEvent(/ \(OG\)$/.test(opts.player || '') ? 'own_goal' : 'goal', side, { player: opts.player, t: minute });
            if (C.ticker && C.ticker.autoGoalNews) {
                const h = state.home, a = state.away;
                const text = `${h.short || h.name} ${state.score.home} - ${state.score.away} ${a.short || a.name}` +
                    (opts.player ? ` • ${opts.player} ${minute}` : '');
                state.ticker.messages = [{ tag: 'GOAL', text }].concat(
                    state.ticker.messages.filter((m) => window.Ticker.normalize(m).tag !== 'GOAL'));
            }
            commit();
            window.Scoreboard.flash(side);
            const goalCtx = ctx({ side, team: state[side], player: opts.player || '', minute });
            if (tributeAuto('autoGoal', opts.player)) window.Tribute.show('goal', goalCtx, opts.duration);
            else window.Popup.show('GOAL', goalCtx, opts.duration);
            emitEvent('goal');
        },
        yellowCard(opts) {
            opts = opts || {};
            if (opts.count !== false) countCard(opts.team, 'yellow');
            logEvent('yellow_card', opts.team, { player: opts.player, t: opts.minute || currentMinute() });
            window.Popup.show('YELLOW_CARD', ctx({ player: opts.player, team: teamObj(opts.team), minute: opts.minute || currentMinute() }), opts.duration);
        },
        redCard(opts) {
            opts = opts || {};
            if (opts.count !== false) countCard(opts.team, 'red');
            logEvent('red_card', opts.team, { player: opts.player, t: opts.minute || currentMinute() });
            window.Popup.show('RED_CARD', ctx({ player: opts.player, team: teamObj(opts.team), minute: opts.minute || currentMinute() }), opts.duration);
        },
        substitution(opts) {
            opts = opts || {};
            logEvent('substitution', opts.team, { in: opts.in, out: opts.out, t: opts.minute || currentMinute() });
            if (tributeAuto('autoOvation', opts.out)) return API.showTribute('ovation', { in: opts.in });
            window.Popup.show('SUBSTITUTION', ctx({ out: opts.out, in: opts.in, team: teamObj(opts.team) }), opts.duration);
        },
        /** Bắt đầu trận: hiệp 1, 00:00, chạy đồng hồ + popup. */
        matchStart(opts) {
            opts = opts || {};
            if (opts.changePeriod !== false) {
                state.period = '1H';
                state.addedTime = 0;
                state.clock = { running: true, base: 0, anchor: Date.now() };
                commit();
            }
            window.Popup.show('MATCH_START', ctx(opts));
            emitEvent('matchstart');
        },
        /** Nghỉ giữa hiệp: dừng đồng hồ, chuyển HT + popup. */
        halfTime(opts) {
            opts = opts || {};
            if (opts.changePeriod !== false) API.setPeriod('HT');
            window.Popup.show('HALF_TIME', ctx(opts));
            emitEvent('halftime');
        },
        /** Kết thúc: dừng đồng hồ, chuyển FT + popup tỷ số. */
        fullTime(opts) {
            opts = opts || {};
            if (opts.changePeriod !== false) API.setPeriod('FT');
            window.Popup.show('FULL_TIME', ctx(opts));
            emitEvent('fulltime');
        },
        /** Chỉ hiện popup (không đổi trạng thái trận). type: GOAL | YELLOW_CARD | RED_CARD |
         *  SUBSTITUTION | MATCH_START | HALF_TIME | FULL_TIME | CUSTOM */
        showPopup(type, data) {
            data = data || {};
            const t = String(type || 'CUSTOM').toUpperCase();
            const side = sideOf(data.team);
            const extra = Object.assign({ side, minute: currentMinute() }, data, { team: teamObj(data.team) || state[side] });
            window.Popup.show(t, ctx(extra), data.duration);
        },
        hidePopup() { window.Popup.skip(); },
        clearPopups() { window.Popup.clear(); },

        /* ---------- TICKER ---------- */
        /** Đưa 1 tin lên đầu ticker (mặc định tag BREAKING) và đảm bảo ticker đang chạy. */
        showTicker(text, tag) {
            if (text) {
                const item = { tag: tag || 'BREAKING', text: String(text) };
                state.ticker.messages = [item].concat(state.ticker.messages.filter((m) => window.Ticker.normalize(m).text !== item.text));
            }
            state.ticker.visible = true;
            state.ticker.running = true;
            commit();
        },
        /** Thay toàn bộ nội dung: mảng hoặc chuỗi nhiều dòng ("TAG|nội dung"). */
        setTicker(messages) { state.ticker.messages = normalizeTickerList(messages); commit(); },
        addTickerMessage(text, tag) {
            if (!text) return;
            state.ticker.messages = state.ticker.messages.concat([tag ? { tag, text } : text]);
            commit();
        },
        tickerStart() { state.ticker.running = true; state.ticker.visible = true; commit(); },
        tickerStop() { state.ticker.running = false; commit(); },
        setTickerVisible(v) { state.ticker.visible = !!v; commit(); },
        toggleTicker() { state.ticker.visible = !state.ticker.visible; commit(); },
        setTickerSpeed(v) { state.ticker.speed = Math.max(5, Number(v) || 90); commit(); },
        setTickerDirection(d) { state.ticker.direction = d === 'right' ? 'right' : 'left'; commit(); },

        /* ---------- CHAT ---------- */
        /** chat("user", "nội dung")  hoặc  chat({ user, text, color }) */
        chat(user, text, color) {
            const msg = (user && typeof user === 'object') ? user : { user, text, color };
            window.Chat.add(msg);
        },
        setChatVisible(v) { state.chat.visible = !!v; commit(); },
        toggleChat() { state.chat.visible = !state.chat.visible; commit(); },
        clearChat() { window.Chat.clear(); },
        setFakeChat(on) { state.chat.fake = !!on; commit(); },
        setChatMax(n) { state.chat.max = Math.max(1, Math.min(12, int(n, 5))); commit(); },

        /* ---------- LOWER THIRD ---------- */
        showLowerThird(data) { window.LowerThird.show(Object.assign({}, data || window.I18N.deep(C.lowerThird && C.lowerThird.default))); },
        hideLowerThird() { window.LowerThird.hide(); },
        toggleLowerThird(data) { window.LowerThird.isVisible() ? API.hideLowerThird() : API.showLowerThird(data); },

        /* ---------- LOGO / WATERMARK ---------- */
        setLogo(url) { state.watermark.logo = url || ''; commit(); },
        setWatermark(data) { Object.assign(state.watermark, data || {}); commit(); },
        setWatermarkVisible(v) { state.watermark.visible = !!v; commit(); },
        toggleWatermark() { state.watermark.visible = !state.watermark.visible; commit(); },
        setWatermarkOpacity(v) { state.watermark.opacity = Math.max(0.05, Math.min(1, Number(v) || 1)); commit(); },

        /* ---------- DONATION ---------- */
        showDonation(data) {
            const d = Object.assign({}, state.donation, data || {});
            window.Donation.show(d, data && data.duration);
        },
        hideDonation() { window.Donation.hide(); },
        toggleDonation() { window.Donation.isVisible() ? API.hideDonation() : API.showDonation(); },
        setDonation(data) {
            Object.assign(state.donation, data || {});
            window.Donation.render(state.donation);
            commit();
        },

        /* ---------- SOCIAL ---------- */
        showSocial(data) { window.Social.show(Object.assign({}, C.social, data || {}), data && data.duration); },
        hideSocial() { window.Social.hide(); },
        toggleSocial() { window.Social.isVisible() ? API.hideSocial() : API.showSocial(); },

        /* ---------- HIỂN THỊ ---------- */
        setLive(v) { state.live = !!v; commit(); },
        toggleLive() { state.live = !state.live; commit(); },
        setDateVisible(v) { state.date.visible = !!v; commit(); },
        toggleDate() { state.date.visible = !state.date.visible; commit(); },
        /** setDate({day, month, year}) để nhập tay, setDate(null) để quay lại tự động */
        setDate(d) {
            if (d && d.day) { state.date.mode = 'manual'; state.date.manual = { day: int(d.day, 1), month: int(d.month, 1), year: int(d.year, 2026) }; }
            else state.date.mode = 'auto';
            commit();
        },
        setFrame(v) { state.frame = !!v; commit(); },
        toggleFrame() { state.frame = !state.frame; commit(); },
        setScoreboardVisible(v) { state.scoreboardVisible = !!v; commit(); },
        toggleScoreboard() { state.scoreboardVisible = !state.scoreboardVisible; commit(); },

        /* ---------- THEME ---------- */
        /** neon | premier | gold | classic */
        setTheme(name) { if (THEMES.includes(name)) { state.theme = name; commit(); } },
        cycleTheme() { API.setTheme(THEMES[(THEMES.indexOf(state.theme) + 1) % THEMES.length]); },

        /* ---------- CHẾ ĐỘ PHÂN TÍCH (camera nhỏ + heatmap + thống kê) ---------- */
        /** layout: normal | analysis (camera lớn + heatmap nhỏ) | heatbig (heatmap lớn + camera nhỏ góc phải) */
        setLayout(layout) { state.layout = ['analysis', 'heatbig', 'trackbig'].includes(layout) ? layout : 'normal'; commit(); },
        toggleAnalysis() { API.setLayout(state.layout === 'analysis' ? 'normal' : 'analysis'); },
        toggleHeatBig() { API.setLayout(state.layout === 'heatbig' ? 'normal' : 'heatbig'); },
        /** Sa bàn trực tiếp lớn + camera nhỏ góc phải. */
        toggleTrackBig() { API.setLayout(state.layout === 'trackbig' ? 'normal' : 'trackbig'); },
        /** Sa bàn từ live-football-api.com: url = csb_url (đã có token). */
        setTrackerUrl(url, label) {
            if (!/^https:\/\/live-football-api\.com\//.test(String(url || ''))) return;
            state.tracker = { url: String(url), label: String(label || '') };
            commit();
        },

        /* ---------- THỐNG KÊ ---------- */
        /** key: shots | onTarget | corners | fouls | offsides | yellow | red | saves */
        setStat(team, key, value) {
            if (!STAT_KEYS.includes(key)) return;
            state.stats[sideOf(team)][key] = Math.max(0, int(value, 0));
            commit();
        },
        addStat(team, key, delta) {
            if (!STAT_KEYS.includes(key)) return;
            const s = sideOf(team);
            state.stats[s][key] = Math.max(0, (state.stats[s][key] || 0) + int(delta, 1));
            commit();
        },
        resetStats() {
            state.stats = { home: zeroStats(), away: zeroStats() };
            state.possession = { side: null, home: 0, away: 0, anchor: null };
            commit();
        },
        /** Popup bảng thống kê. opts: { keys:[...], duration } */
        showStats(opts) {
            opts = opts || {};
            window.Popup.show('STATS', ctx({ rows: statRows(opts.keys || ['possession', 'shots', 'onTarget', 'corners', 'fouls', 'offsides', 'yellow', 'red']) }), opts.duration);
        },
        /** Đội đang giữ bóng: "home" | "away" | null (dừng đếm). */
        setPossession(team) {
            flushPossession();
            state.possession.side = (team === 'home' || team === 'away') ? team : null;
            commit();
        },
        resetPossession() { state.possession = { side: null, home: 0, away: 0, anchor: null }; commit(); },

        /* ---------- HEATMAP ---------- */
        /** x, y trong khoảng 0..1 (đội nhà tấn công sang phải). */
        addHeat(team, x, y) { API.addHeatPoints(team, [[x, y]]); },
        addHeatPoints(team, points) {
            const s = sideOf(team);
            const clean = (points || []).map((p) => [Math.min(1, Math.max(0, +p[0] || 0)), Math.min(1, Math.max(0, +p[1] || 0))])
                .map((p) => [+p[0].toFixed(3), +p[1].toFixed(3)]);
            state.heat[s] = state.heat[s].concat(clean).slice(-HEAT_MAX);
            state.heat.rev = (state.heat.rev || 0) + 1;
            commit();
        },
        /** team: "home" | "away" | bỏ trống = xoá cả hai */
        clearHeat(team) {
            if (team === 'home' || team === 'away') state.heat[team] = [];
            else { state.heat.home = []; state.heat.away = []; }
            state.heat.rev = (state.heat.rev || 0) + 1;
            commit();
        },
        simulateHeat(team) {
            ['home', 'away'].filter((s) => !team || s === team).forEach((s) => {
                state.heat[s] = state.heat[s].concat(window.Analysis.Heat.simulate(s, 140)).slice(-HEAT_MAX);
            });
            state.heat.rev = (state.heat.rev || 0) + 1;
            commit();
        },
        /** view: auto (luân phiên 2 đội) | home | away | both */
        setHeatView(view) { state.heat.view = ['auto', 'home', 'away', 'both'].includes(view) ? view : 'auto'; commit(); },

        /* ---------- ĐỘI HÌNH ---------- */
        /** data: { formation, coach, players:[...], subs:[...] } hoặc { text } (nhiều dòng, "---" ngăn dự bị) */
        setLineup(team, data) {
            const s = sideOf(team);
            data = data || {};
            const L = state.lineups[s];
            if (data.formation !== undefined) L.formation = String(data.formation);
            if (data.coach !== undefined) L.coach = String(data.coach);
            if (data.text !== undefined) {
                const parsed = window.Lineup.parseText(data.text);
                L.players = parsed.players;
                L.subs = parsed.subs;
            }
            if (data.players) L.players = window.Lineup.parseList(data.players);
            if (data.subs) L.subs = window.Lineup.parseList(data.subs);
            commit();
            if (window.Lineup.isVisible()) API.showLineup(window.Lineup.view());
        },
        /** view: both | home | away */
        showLineup(view) {
            const was = window.Lineup.isVisible();
            window.Lineup.show(view || 'both', state.lineups, window.I18N.team(state.home), window.I18N.team(state.away));
            if (!was) emitEvent('lineup-show');
        },
        hideLineup() {
            if (window.Lineup.isVisible()) emitEvent('lineup-hide');
            window.Lineup.hide();
        },

        /* ---------- CAMERA (2 cam, điều khiển qua OBS) ---------- */
        /** layout: close (cam cận) | wide (toàn cảnh) | pip | pip2 | split */
        setCamLayout(layout) {
            if (!CAM_LAYOUTS.includes(layout)) return;
            if (PHOTO_LAYOUTS.includes(layout) && !PHOTO_LAYOUTS.includes(state.cam.layout)) {
                camBeforeSplit = state.cam.layout;
                window.Photo.hide();
                if (!state.splitPhoto && state.photos[0]) state.splitPhoto = Object.assign({}, state.photos[0]);
            }
            state.cam = { layout };
            commit();
        },
        /** Quy tắc tự chuyển: { enabled, lineup, goal, goalHold, halfTime, fullTime, matchStart } ("" = không đổi) */
        setCamAuto(data) { Object.assign(state.camAuto, data || {}); commit(); },
        toggleLineup(view) {
            const v = view || 'both';
            if (window.Lineup.isVisible() && window.Lineup.view() === v) API.hideLineup(); else API.showLineup(v);
        },

        /* ---------- TRI ÂN HUYỀN THOẠI ---------- */
        /** scene: matchday | legend | card | goal | ovation | thanks.  data.duration (ms, 0 = giữ) */
        showTribute(scene, data) {
            data = data || {};
            window.Popup.skip();
            window.Tribute.show(scene, ctx(Object.assign({ minute: currentMinute(), channel: C.channelName }, data)), data.duration);
        },
        hideTribute() { window.Tribute.hide(); },
        toggleTribute(scene) {
            if (window.Tribute.current() === scene) API.hideTribute(); else API.showTribute(scene);
        },
        setTributeBadge(v) { state.tributeBadge = !!v; commit(); },
        toggleTributeBadge() { state.tributeBadge = !state.tributeBadge; commit(); },

        /* ---------- KHUNG ẢNH TRẬN ĐẤU ---------- */
        /** data: { src, caption, show = true, duration } — thêm ảnh vào bộ sưu tập (ảnh mới nhất đứng đầu). */
        addPhoto(data) {
            data = data || {};
            if (!data.src) return;
            const item = { src: String(data.src), caption: String(data.caption || ''), minute: data.minute != null ? String(data.minute) : photoMinute() };
            state.photos = [item].concat(state.photos.filter((p) => p.src !== item.src)).slice(0, PHOTO_MAX);
            commit();
            if (data.show !== false) API.showPhoto(0, data.duration);
        },
        /** index trong bộ sưu tập (0 = mới nhất). duration ms, 0 = giữ. */
        showPhoto(index, duration) {
            const i = Math.max(0, Math.min(state.photos.length - 1, int(index, 0)));
            const item = state.photos[i];
            if (!item) return;
            photoIdx = i;
            const pos = state.photos.length > 1 ? `${i + 1}/${state.photos.length}` : '';
            if (inPhotoSplit()) {                    // đang chia đôi cam + ảnh → đổi ảnh ở nửa phải
                state.splitPhoto = Object.assign({ pos }, item);
                commit();
                return;
            }
            window.Photo.show(item, state.photos.length > 1 ? `${i + 1}/${state.photos.length}` : '', slideTimer ? 0 : duration);
        },
        nextPhoto() { API.showPhoto(photoIdx + 1 < state.photos.length ? photoIdx + 1 : 0); },
        prevPhoto() { API.showPhoto(photoIdx > 0 ? photoIdx - 1 : state.photos.length - 1); },
        hidePhoto() {
            API.setPhotoSlideshow(0);
            if (inPhotoSplit()) API.exitPhotoSplit();
            window.Photo.hide();
        },
        togglePhoto() { (window.Photo.isVisible() || inPhotoSplit()) ? API.hidePhoto() : API.showPhoto(0); },
        /** Chia đôi màn hình: camera bên trái, ảnh trận đấu bên phải.
         *  index: ảnh trong bộ sưu tập (bỏ trống = ảnh đang chọn / mới nhất). cam: "close" | "wide" */
        photoSplit(index, cam) {
            const layout = cam === 'wide' ? 'photo2' : 'photo';
            if (!inPhotoSplit()) camBeforeSplit = state.cam.layout;
            const i = index == null ? (state.splitPhoto ? photoIndexOf(state.splitPhoto.src) : 0) : int(index, 0);
            window.Photo.hide();
            state.cam = { layout };
            commit();
            if (state.photos.length) API.showPhoto(Math.max(0, i));
        },
        /** Thoát chia đôi → quay lại bố cục camera trước đó. */
        exitPhotoSplit() {
            if (!inPhotoSplit()) return;
            API.setCamLayout(PHOTO_LAYOUTS.includes(camBeforeSplit) ? 'close' : (camBeforeSplit || 'close'));
        },
        setPhotoCaption(index, caption) {
            const item = state.photos[int(index, -1)];
            if (!item) return;
            item.caption = String(caption || '');
            if (state.splitPhoto && state.splitPhoto.src === item.src) state.splitPhoto = Object.assign({}, state.splitPhoto, { caption: item.caption });
            commit();
            if (window.Photo.current() && window.Photo.current().src === item.src) API.showPhoto(index);
        },
        removePhoto(index) {
            const i = int(index, -1);
            const item = state.photos[i];
            if (!item) return;
            state.photos.splice(i, 1);
            if (state.splitPhoto && state.splitPhoto.src === item.src) {
                const next = state.photos[Math.min(i, state.photos.length - 1)];
                state.splitPhoto = next ? Object.assign({}, next) : null;
            }
            commit();
            if (window.Photo.current() && window.Photo.current().src === item.src) {
                if (state.photos.length) API.showPhoto(Math.min(i, state.photos.length - 1)); else API.hidePhoto();
            }
        },
        clearPhotos() { state.photos = []; state.splitPhoto = null; API.hidePhoto(); commit(); },
        /** Trình chiếu: đổi ảnh mỗi `seconds` giây. 0 = tắt. */
        setPhotoSlideshow(seconds) {
            clearInterval(slideTimer);
            slideTimer = null;
            const sec = Math.max(0, Number(seconds) || 0);
            if (sec > 0 && state.photos.length) {
                slideTimer = setInterval(() => API.nextPhoto(), Math.max(3, sec) * 1000);
                if (!window.Photo.isVisible()) API.showPhoto(0);
                else API.showPhoto(photoIdx);
            }
        },

        /* ---------- ĐẾM NGƯỢC TRƯỚC TRẬN ---------- */
        startCountdown(minutes, title, sub) {
            const ms = Math.max(1, Number(minutes) || 5) * 60000;
            state.countdown = { target: Date.now() + ms, title: title || (C.countdown && C.countdown.title) || 'TRẬN ĐẤU SẮP BẮT ĐẦU', sub: sub || (C.countdown && C.countdown.sub) || '' };
            commit();
        },
        stopCountdown() { state.countdown = null; commit(); },

        /* ---------- DEMO ---------- */
        setDemo(on) {
            state.demo = !!on;
            if (state.demo) runDemo(); else { stopDemo(); commit(); }
        },
        toggleDemo() { API.setDemo(!state.demo); },

        getState() { return JSON.parse(JSON.stringify(state)); },
        getClockSeconds() { return clockSeconds(); }
    };

    /* ------------------------------------------------------------------
     * DEMO MODE — kịch bản lặp lại ~150 giây
     * ------------------------------------------------------------------ */
    let demoTimers = [];
    let demoLoop = null;

    function stopDemo() {
        demoTimers.forEach(clearTimeout);
        demoTimers = [];
        clearInterval(demoLoop);
        demoLoop = null;
    }

    /** Diễn biến nền của demo: đổi đội giữ bóng, cộng thống kê, thêm điểm heatmap. */
    function demoPulse() {
        if (!state.demo || !state.clock.running) return;
        const r = Math.random();
        const side = state.possession.side || 'home';
        if (r < 0.3) API.setPossession(side === 'home' ? (Math.random() < 0.4 ? 'home' : 'away') : (Math.random() < 0.5 ? 'away' : 'home'));
        else if (r < 0.45) API.addStat(side, 'shots', 1);
        else if (r < 0.55) API.addStat(side, 'corners', 1);
        else if (r < 0.68) API.addStat(side === 'home' ? 'away' : 'home', 'fouls', 1);
        else if (r < 0.72) API.addStat(side, 'offsides', 1);
        else if (r < 0.8) { API.addStat(side, 'shots', 1); API.addStat(side, 'onTarget', 1); }
        API.addHeatPoints(side, window.Analysis.Heat.simulate(side, 6));
    }

    function runDemo() {
        stopDemo();
        const D = C.demo || {};
        const P = D.players || { home: ['PLAYER A'], away: ['PLAYER B'] };
        const at = (sec, fn) => demoTimers.push(setTimeout(() => { if (state.demo) fn(); }, sec * 1000));

        window.Popup.clear();
        window.LowerThird.hide();
        state.demo = true;
        state.layout = 'normal';
        state.score = { home: 0, away: 0 };
        state.period = '1H';
        state.addedTime = 0;
        state.clock = { running: true, base: 0, anchor: Date.now() };
        state.ticker.messages = defaultState().ticker.messages;
        state.ticker.visible = true;
        state.ticker.running = true;
        state.chat.visible = true;
        state.scoreboardVisible = true;
        state.stats = { home: zeroStats(), away: zeroStats() };
        state.possession = { side: 'home', home: 0, away: 0, anchor: null };
        state.heat = { home: window.Analysis.Heat.simulate('home', 90), away: window.Analysis.Heat.simulate('away', 70), view: 'auto', rev: (state.heat.rev || 0) + 1 };
        commit();
        demoLoop = setInterval(demoPulse, 2600);

        at(1, () => API.showLineup('both'));
        at(11, () => API.hideLineup());
        at(12.5, () => window.Popup.show('MATCH_START', ctx()));
        at(18, () => API.showLowerThird(D.commentator));
        at(25, () => API.goal({ team: 'home', player: pick(P.home) }));
        at(34, () => API.yellowCard({ team: 'away', player: pick(P.away) }));
        at(41, () => API.substitution({ team: 'away', out: P.away[0], in: P.away[P.away.length - 1] }));
        at(49, () => API.showSocial());
        at(57, () => API.setLayout('analysis'));
        at(75, () => API.setLayout('normal'));
        at(78, () => API.showDonation({ duration: 12000 }));
        at(92, () => API.goal({ team: 'away', player: pick(P.away) }));
        at(101, () => API.showStats());
        at(112, () => { API.setTime(44, 48); API.setAddedTime(2); });
        at(123, () => API.halfTime());
        at(131, () => { API.setPeriod('2H'); API.startClock(); });
        at(134, () => API.showLowerThird({ name: pick(P.home), role: 'TIỀN VỆ', team: state.home.short }));
        at(141, () => API.goal({ team: 'home', player: pick(P.home) }));
        at(151, () => API.redCard({ team: 'away', player: pick(P.away) }));
        at(159, () => { API.setTime(89, 50); API.setAddedTime(3); });
        at(171, () => API.fullTime());
        at(178, () => API.showStats());
        at(192, () => runDemo());
    }

    /* ------------------------------------------------------------------
     * KEYBOARD SHORTCUTS (khi cửa sổ overlay được focus / OBS "Interact")
     * ------------------------------------------------------------------ */
    const S = C.shortcuts || {};
    const KEYS = {
        Space: () => API.toggleClock(),
        KeyG: (e) => { const side = e.shiftKey ? 'away' : 'home'; API.goal({ team: side, player: (S.goalPlayer || {})[side] || '' }); },
        KeyY: (e) => API.yellowCard({ player: S.cardPlayer, team: e.shiftKey ? 'away' : 'home' }),
        KeyR: (e) => API.redCard({ player: S.cardPlayer, team: e.shiftKey ? 'away' : 'home' }),
        KeyS: (e) => API.substitution({ out: S.subOut, in: S.subIn, team: e.shiftKey ? 'away' : 'home' }),
        KeyH: () => API.halfTime(),
        KeyF: () => API.fullTime(),
        KeyT: () => API.toggleTicker(),
        KeyC: () => API.toggleChat(),
        KeyL: () => API.toggleLowerThird(),
        KeyD: () => API.toggleDonation(),
        KeyA: (e) => (e.shiftKey ? API.toggleHeatBig() : API.toggleAnalysis()),
        KeyB: (e) => { if (e.shiftKey) API.toggleTrackBig(); },
        KeyU: (e) => API.toggleLineup(e.shiftKey ? 'away' : 'both'),
        KeyK: () => API.showStats(),
        KeyM: () => API.toggleTribute('card'),
        KeyP: () => API.togglePhoto(),
        KeyX: (e) => API.photoSplit(null, e.shiftKey ? 'wide' : 'close'),
        Digit1: () => API.setPossession('home'),
        Digit2: () => API.setPossession('away'),
        Digit0: () => API.setPossession(null)
    };
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
        const tag = (e.target && e.target.tagName) || '';
        if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
        const fn = KEYS[e.code];
        if (fn) { e.preventDefault(); fn(e); }
    });

    /* ------------------------------------------------------------------
     * BUS — nhận lệnh từ control panel / server
     * ------------------------------------------------------------------ */
    const BLOCKED = new Set(['getState', 'getClockSeconds']);
    window.Bus.on((msg) => {
        if (msg.type === 'cmd') {
            const { fn, args } = msg.payload || {};
            if (typeof API[fn] === 'function' && !BLOCKED.has(fn)) {
                API[fn].apply(null, Array.isArray(args) ? args : (args === undefined ? [] : [args]));
            }
        } else if (msg.type === 'hello') {
            persistNow();
        } else if (msg.type === 'yt-status') {
            window.Chat.setSource(msg.payload && msg.payload.state === 'live' ? 'youtube' : null);
        } else if (msg.type === 'stale') {
            // Server báo config.js đã đổi mà overlay này chưa tải lại → tự refresh (tối đa 1 lần / 30 giây)
            const p = msg.payload || {};
            if (p.fingerprint && p.fingerprint !== FINGERPRINT && (!p.target || p.target === window.Bus.id)) {
                let last = 0;
                try { last = Number(sessionStorage.getItem('overlay-stale-reload')) || 0; } catch (e) { /* ignore */ }
                if (Date.now() - last > 30000) {
                    try { sessionStorage.setItem('overlay-stale-reload', String(Date.now())); } catch (e) { /* ignore */ }
                    location.reload();
                }
            }
        } else if (msg.type === 'state') {
            // Nhiều overlay cùng chạy (OBS, bản tiếng Anh, tab xem thử): luôn theo state mới nhất
            // để không overlay nào giữ trạng thái lệch (vd. 1 bên phân tích, 1 bên bình thường).
            const s = msg.payload;
            if (s && s.fingerprint === FINGERPRINT && s.savedAt > state.savedAt) {
                state = mergeState(s);
                if (!booted) return;            // boot() sẽ tự vẽ với state này
                window.Donation.render(state.donation);
                renderAll();
            }
        }
    });

    /* ------------------------------------------------------------------
     * STAGE SCALE (OBS 1920x1080 → scale 1; trình duyệt → co cho vừa)
     * ------------------------------------------------------------------ */
    function fitStage() {
        const stage = $('stage');
        const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
        if (Math.abs(s - 1) < 0.001) { stage.style.transform = ''; stage.style.left = '0px'; stage.style.top = '0px'; return; }
        stage.style.transform = `scale(${s})`;
        stage.style.left = Math.round((window.innerWidth - 1920 * s) / 2) + 'px';
        stage.style.top = Math.round((window.innerHeight - 1080 * s) / 2) + 'px';
    }

    /* ------------------------------------------------------------------
     * DEV BAR (chỉ khi xem bằng trình duyệt thường)
     * ------------------------------------------------------------------ */
    function setupDevBar() {
        if (IN_OBS || params.has('clean')) return;
        let bg = true;
        try { bg = localStorage.getItem(BG_KEY) !== '0'; } catch (e) { /* ignore */ }
        if (params.get('bg') === '0') bg = false;
        document.documentElement.classList.toggle('preview-bg', bg);
        $('devbar').hidden = false;
        $('dev-demo').onclick = () => API.toggleDemo();
        $('dev-bg').onclick = () => {
            bg = !bg;
            document.documentElement.classList.toggle('preview-bg', bg);
            try { localStorage.setItem(BG_KEY, bg ? '1' : '0'); } catch (e) { /* ignore */ }
        };
    }

    /* ------------------------------------------------------------------
     * BOOT
     * ------------------------------------------------------------------ */
    function boot() {
        window.Scoreboard.init();
        window.Ticker.init($('ticker'));
        window.Chat.init($('chat'), C.chat);
        window.Popup.init($('popup-layer'), C.popup);
        window.LowerThird.init($('lowerthird'), C.lowerThird);
        window.Donation.init($('donation'), state.donation);
        window.Social.init($('social'), C.social);
        window.Lineup.init($('lineup'));
        window.Analysis.init($('analysis'), C.analysis);
        window.Countdown.init($('countdown'), () => API.stopCountdown());
        window.CamFx.init($('camfx'), window.I18N.deep(C.cameras));
        window.Tribute.init($('tribute'), $('tribute-badge'), window.I18N.deep(C.tribute));
        // Logo gần vuông (huy hiệu CLB từ API) → hiện đủ, không cắt như cờ 3:2
        document.addEventListener('load', (e) => {
            const im = e.target;
            if (!im || im.tagName !== 'IMG' || !im.naturalWidth) return;
            const crest = im.naturalWidth / im.naturalHeight < 1.25;
            im.classList.toggle('is-crest', crest);
            if (im.parentNode && im.parentNode.classList) im.parentNode.classList.toggle('has-crest', crest);
        }, true);
        window.Photo.init($('photo'), window.I18N.deep(C.photo));
        document.documentElement.dataset.theme = state.theme;
        booted = true;

        fitStage();
        window.addEventListener('resize', fitStage);
        setupDevBar();

        // Cho các thành phần trượt vào lần lượt khi mở
        requestAnimationFrame(() => setTimeout(renderAll, 60));

        setInterval(tick, 200);
        setInterval(renderDate, 30000);
        // % kiểm soát bóng thay đổi theo thời gian → cập nhật bảng phân tích mỗi giây
        setInterval(() => { if (state.layout !== 'normal') renderAnalysis(); }, 1000);

        if (C.donation && C.donation.interval > 0) setInterval(() => API.showDonation(), C.donation.interval * 1000);
        if (C.social && C.social.interval > 0) setInterval(() => API.showSocial(), C.social.interval * 1000);

        // Chờ server gửi state mới nhất (nếu có) rồi mới quyết định demo
        const demoParam = params.get('demo');
        setTimeout(() => {
            syncWindow = false;
            if (demoParam === '0') state.demo = false;
            if (demoParam === '1') state.demo = true;
            if (state.demo) runDemo();
            else {
                if (C.match && C.match.autoStart && !state.savedAt) API.startClock();
                commit();
            }
        }, window.Bus.status().http ? 800 : 50);
    }

    window.Overlay = API;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
