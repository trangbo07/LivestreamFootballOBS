/* =====================================================================
 *  LIVE-STATS.JS — tự cập nhật mọi thứ của trận đấu từ Live Football API
 *  (https://live-football-api.com — điều khoản cho phép dùng thương mại).
 *
 *  Mỗi lượt hỏi: /live_match_details (1 credit) → tỷ số, đồng hồ, hiệp,
 *  thống kê, sự kiện, tên đội, logo, sân, trọng tài, sa bàn (csb_url).
 *  Đội hình: /lineups (1 credit) — hỏi đến khi có đội hình chính thức.
 *
 *  Phát ra:
 *    'status'  { state: off|waiting|live|done|error, message, match, remaining, updatedAt }
 *    'cmd'     (fn, ...args) — lệnh gửi cho overlay (applyLive, goal, setTeams…)
 * ===================================================================== */
const { EventEmitter } = require('events');

const BASE = 'https://live-football-api.com/api/v1';
const CSB_REFRESH_MS = 3 * 3600e3;          // token sa bàn hạn ~4 giờ
const LINEUP_RETRY_MS = 10 * 60e3;          // chưa có đội hình chính thức → hỏi lại sau 10 phút

/** Bỏ dấu + viết hoa + bỏ ký tự đặc biệt để so tên ("ĐT ARGENTINA" ~ "Argentina", "AL-NASSR" ~ "Al Nassr"). */
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toUpperCase().replace(/^DT\s+/, '').replace(/[^A-Z0-9]+/g, ' ').trim();
const same = (a, b) => { a = norm(a); b = norm(b); return !!a && !!b && (a === b || a.includes(b) || b.includes(a)); };
const num = (v) => { const n = parseInt(String(v == null ? '' : v).replace('%', ''), 10); return Number.isFinite(n) ? n : null; };
const nameOf = (p) => (p && typeof p === 'object' ? p.name : p) || '';

// Nhãn thống kê (viết thường) → khoá thống kê của overlay
const STAT_MAP = {
    'possession': 'possession', 'ball possession': 'possession',
    'shots': 'shots', 'total shots': 'shots', 'shots total': 'shots',
    'shots on target': 'onTarget', 'on target': 'onTarget', 'shots on goal': 'onTarget',
    'corners': 'corners', 'corner kicks': 'corners',
    'fouls': 'fouls', 'offsides': 'offsides',
    'yellow cards': 'yellow', 'red cards': 'red',
    'saves': 'saves', 'goalkeeper saves': 'saves'
};

class LiveStats extends EventEmitter {
    constructor() {
        super();
        this.status = { state: 'off', message: 'Chưa bật' };
        this.timer = null;
        this.opts = null;
    }

    setStatus(s) {
        this.status = Object.assign({}, this.status, s);
        this.emit('status', this.status);
    }

    async request(apiKey, pathAndQuery) {
        if (!apiKey) throw new Error('Chưa nhập key Live Football API');
        const sep = pathAndQuery.includes('?') ? '&' : '?';
        const r = await fetch(`${BASE}${pathAndQuery}${sep}api_key=${encodeURIComponent(apiKey)}&lang=en`);
        if (r.status === 429) throw new Error('Hỏi quá nhanh (429) — tăng thời gian cập nhật');
        const j = await r.json().catch(() => ({}));
        if (j.credits_remaining != null) this.setStatus({ remaining: Number(j.credits_remaining) });
        if (!j.success) throw new Error('Live Football API: ' + (j.message || 'HTTP ' + r.status));
        return j.data || {};
    }

    /** Tìm trận theo ngày (YYYY-MM-DD, giờ UTC) + tên đội / giải. Tốn 1 credit. */
    async search(apiKey, q, date) {
        const d = await this.request(apiKey, `/matches?date=${encodeURIComponent(date)}`);
        const k = norm(q);
        return (d.matches || [])
            .filter((m) => !k || [m.home && m.home.name, m.away && m.away.name, m.league && m.league.name].some((n) => norm(n).includes(k)))
            .slice(0, 30)
            .map((m) => ({
                id: m.id, home: m.home && m.home.name, away: m.away && m.away.name,
                league: m.league && m.league.name, country: m.league && m.league.country,
                kickoff: m.kickoff, status: m.status && (m.status.display || m.status.status)
            }));
    }

    /**
     * opts: { apiKey, matchId, league, interval (giây), swap: 'auto'|true|false, popups,
     *         homeName, awayName (tên đội đang có trên overlay — để nhận đúng đội nhà) }
     */
    start(opts) {
        this.stop(true);
        this.opts = Object.assign({ interval: 15, swap: 'auto', popups: true }, opts);
        this.seen = new Set();
        this.prev = null;
        this.period = null;
        this.swap = false;
        this.teamSig = '';
        this.lineupSig = '';
        this.lineupNext = 0;
        this.lineupFinal = false;
        this.csbAt = 0;
        this.setStatus({ state: 'waiting', message: 'Đang lấy dữ liệu trận ' + this.opts.matchId + '…', match: null });
        this.poll();
    }

    stop(silent) {
        clearTimeout(this.timer);
        this.timer = null;
        this.opts = null;
        if (!silent) this.setStatus({ state: 'off', message: 'Đã dừng' });
    }

    schedule(sec) {
        clearTimeout(this.timer);
        if (this.opts) this.timer = setTimeout(() => this.poll(), sec * 1000);
    }

    async poll() {
        const o = this.opts;
        if (!o) return;
        let d;
        try {
            d = await this.request(o.apiKey, '/live_match_details?match_id=' + encodeURIComponent(o.matchId));
        } catch (e) {
            this.setStatus({ state: 'error', message: e.message });
            return this.schedule(Math.max(o.interval, 30));
        }
        if (this.opts !== o) return;            // đã dừng / đổi trận trong lúc chờ
        let phase = 'live';
        try {
            phase = this.apply(d);
        } catch (e) {
            this.setStatus({ state: 'error', message: 'Lỗi xử lý dữ liệu: ' + e.message });
        }
        if (!this.lineupFinal && Date.now() >= this.lineupNext) this.fetchLineups(o).catch((e) => console.log('  [Live] đội hình: ' + e.message));
        if (phase === 'done') return this.stop(true);
        this.schedule(phase === 'waiting' ? Math.max(o.interval, 120) : o.interval);   // chưa đá: hỏi thưa hơn
    }

    /** Đội nhà của API có phải đội khách trên overlay không. */
    swapped(home) {
        const o = this.opts;
        if (o.swap === true || o.swap === false) return o.swap;
        return !same(home, o.homeName) && same(home, o.awayName);
    }

    /** Trạng thái API → hiệp của overlay (null = chưa đá). */
    periodOf(st) {
        const state = String(st.state || '').toLowerCase();
        const status = String(st.status || '').toLowerCase();
        const disp = String(st.display || '').toUpperCase();
        const min = num(st.minute);
        const plus = /\+/.test(String(st.minute || '') + disp);
        if (status === 'finished' || state === 'postgame' || state === 'finished') return 'FT';
        if (state === 'halftime' || disp === 'HT') return 'HT';
        if (/pen/i.test(state) || /PEN/.test(disp)) return 'PEN';
        if (!st.is_live && state !== 'inplay') return null;
        if (min == null) return this.period || '1H';
        if (min > 105) return 'ET2';
        if (min > 90 && !plus) return this.period === 'ET2' ? 'ET2' : 'ET1';     // hiệp phụ
        if (min > 45) return '2H';                                               // kể cả 90+x (bù giờ hiệp 2)
        const second = this.period === 'HT' || this.period === '2H';
        return second ? '2H' : '1H';                                             // 45+x vẫn là hiệp 1
    }

    apply(d) {
        const o = this.opts;
        const h = d.header || {};
        const H0 = h.home || {}, A0 = h.away || {};
        const st = h.status || {};
        const swap = this.swap = this.swapped(H0.name);
        const side = (s) => ((s === 'home') !== swap ? 'home' : 'away');
        const pair = (a, b) => (swap ? { home: b, away: a } : { home: a, away: b });

        this.applyTeams(d, swap);

        const period = this.periodOf(st);
        const prevPeriod = this.period;
        if (period) this.period = period;
        const data = { score: pair(num(H0.score) || 0, num(A0.score) || 0) };
        if (period) data.period = period;
        const min = num(st.minute);
        const mstr = String(st.minute || '') + ' ' + String(st.display || '');
        if (['1H', '2H', 'ET1', 'ET2'].includes(period) && min != null) {
            data.minute = min + (/\+/.test(mstr) ? num(mstr.split('+')[1]) || 0 : 0);
            data.running = true;
        } else if (period) data.running = false;
        const et = st.extra_time;
        if (et && typeof et === 'object') {
            const add = period === '1H' ? et.first_half : period === '2H' ? et.second_half : null;
            if (add != null) data.addedTime = num(add) || 0;
        }

        // Thống kê
        const stats = { home: {}, away: {} };
        (d.stats || []).forEach((x) => {
            const k = STAT_MAP[String(x.label || '').toLowerCase().replace(/\s+/g, ' ').trim()];
            if (!k) return;
            const v = pair(num(x.home), num(x.away));
            if (k === 'possession') { if (v.home != null && v.away != null) data.possession = v; return; }
            ['home', 'away'].forEach((s) => { if (v[s] != null) stats[s][k] = v[s]; });
        });
        // Thẻ: đếm thêm từ danh sách sự kiện (bảng thống kê có thể chậm / thiếu)
        const cards = { home: { yellow: 0, red: 0 }, away: { yellow: 0, red: 0 } };
        (d.events || []).forEach((e) => {
            if (e.type === 'yellow_card' || e.type === 'red_card') cards[side(e.side)][e.type === 'red_card' ? 'red' : 'yellow'] += 1;
        });
        ['home', 'away'].forEach((s) => ['yellow', 'red'].forEach((k) => {
            if (cards[s][k] || stats[s][k] != null) stats[s][k] = Math.max(cards[s][k], stats[s][k] || 0);
        }));
        if (Object.keys(stats.home).length || Object.keys(stats.away).length) data.stats = stats;

        // Timeline tình huống: gửi đủ danh sách mỗi lượt (overlay hiện ở màn sa bàn trực tiếp)
        const TL_TYPES = ['goal', 'own_goal', 'penalty_goal', 'yellow_card', 'red_card', 'substitution', 'missed_penalty', 'var'];
        data.events = (d.events || []).filter((e) => TL_TYPES.includes(e.type)).map((e) => {
            const det = e.detail || {};
            return {
                t: e.time != null ? String(e.time).replace(/\s+/g, '').replace(/'$/, '') : '',
                type: e.type, side: side(e.side),
                player: nameOf(det.player),
                in: nameOf(det.player_in || det.in) || (e.type === 'substitution' ? nameOf(det.player) : ''),
                out: nameOf(det.player_out || det.out) || (e.type === 'substitution' ? nameOf(det.assist) : ''),
                assist: nameOf(det.assist), score: det.score ? String(det.score) : ''
            };
        });

        const first = this.prev === null;
        this.prev = period || 'NS';
        this.emit('cmd', 'applyLive', data);

        // Đổi trạng thái → popup bắt đầu / nghỉ / hết trận (không popup ở lần đọc đầu)
        if (!first && o.popups && prevPeriod !== period) {
            if (!prevPeriod && period === '1H') this.emit('cmd', 'matchStart', { changePeriod: false });
            else if (period === 'HT') this.emit('cmd', 'halfTime', { changePeriod: false });
            else if (period === 'FT') this.emit('cmd', 'fullTime', { changePeriod: false });
        }

        // Sự kiện mới
        (d.events || []).forEach((e) => {
            const det = e.detail || {};
            const key = [e.time, e.type, e.side, nameOf(det.player), nameOf(det.in), nameOf(det.out), det.score].join('|');
            if (this.seen.has(key)) return;
            this.seen.add(key);
            if (first || !o.popups) return;          // lần đầu: chỉ ghi nhận, không bắn lại sự kiện cũ
            const team = side(e.side);
            const minute = e.time != null && e.time !== '' ? String(e.time).replace(/\s+/g, '').replace(/'$/, '') + "'" : undefined;
            const player = nameOf(det.player);
            if (e.type === 'goal' || e.type === 'own_goal') {
                this.emit('cmd', 'goal', { team, player: player + (e.type === 'own_goal' ? ' (OG)' : ''), minute, updateScore: false });
            } else if (e.type === 'yellow_card' || e.type === 'red_card') {
                this.emit('cmd', e.type === 'red_card' ? 'redCard' : 'yellowCard', { team, player, minute, count: false });
            } else if (e.type === 'substitution') {
                const pin = nameOf(det.player_in || det.in) || player;
                const pout = nameOf(det.player_out || det.out || det.assist);
                this.emit('cmd', 'substitution', { team, in: pin, out: pout });
            }
        });

        // Sa bàn trực tiếp: gửi lần đầu + làm mới token định kỳ (không nạp lại iframe mỗi lượt)
        if (d.csb_url && Date.now() - this.csbAt > CSB_REFRESH_MS) {
            this.csbAt = Date.now();
            // csb_url có thể mang lang=tr → ép tiếng Anh (sa bàn không có tiếng Việt)
            const url = /[?&]lang=/.test(d.csb_url) ? d.csb_url.replace(/([?&]lang=)[^&]*/, '$1en') : d.csb_url + '&lang=en';
            this.emit('cmd', 'setTrackerUrl', url, `${H0.name || ''} - ${A0.name || ''}`);
        }

        const phase = period === 'FT' ? 'done' : period ? 'live' : 'waiting';
        this.setStatus({
            state: phase,
            message: `${H0.name || '?'} ${H0.score ?? 0} - ${A0.score ?? 0} ${A0.name || '?'} · ${st.display || st.state || ''}${d.stale ? ' (dữ liệu cũ)' : ''}`,
            match: { id: o.matchId, home: H0.name, away: A0.name, status: st.state, swapped: swap },
            updatedAt: Date.now()
        });
        return phase;
    }

    /** Tên đội + logo + thông tin trận — chỉ gửi khi có thay đổi.
     *  Tên trên overlay cùng nghĩa với tên API (vd. "ĐT ARGENTINA" ~ "Argentina") → giữ tên tiếng Việt. */
    applyTeams(d, swap) {
        const o = this.opts;
        const h = d.header || {};
        const sig = JSON.stringify([h.home && h.home.name, h.home && h.home.logo, h.away && h.away.name, h.away && h.away.logo, swap, d.venue, d.referee, d.match_date]);
        if (sig === this.teamSig) return;
        this.teamSig = sig;
        const H = (swap ? h.away : h.home) || {};
        const A = (swap ? h.home : h.away) || {};
        const team = (t, current) => {
            const x = t.logo ? { logo: t.logo } : {};   // API không có logo → giữ logo đang dùng
            if (t.name && !same(current, t.name)) { x.name = String(t.name).toUpperCase(); x.short = x.name; }
            return x;
        };
        this.emit('cmd', 'setTeams', { home: team(H, o.homeName), away: team(A, o.awayName) });

        const info = {
            competition: String(o.league || '').toUpperCase(),
            venue: (d.venue && d.venue.name) || '',
            referee: nameOf(d.referee),
            sameTeams: same(o.homeName, H.name) && same(o.awayName, A.name)   // false → bỏ hạng FIFA ghi tay
        };
        if (d.match_date) {
            const raw = String(d.match_date);
            const when = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? raw : raw.replace(' ', 'T') + 'Z');   // "2026-10-06 16:00:00" = giờ UTC
            const vn = (opt) => when.toLocaleString('en-GB', Object.assign({ timeZone: 'Asia/Ho_Chi_Minh' }, opt));
            info.date = vn({ day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
            info.time = vn({ hour: '2-digit', minute: '2-digit', hour12: false });
        }
        this.emit('cmd', 'setMatchInfo', info);
        console.log(`  [Live] cập nhật đội: ${H.name} (nhà) - ${A.name} (khách)`);
    }

    /** Đội hình ra sân (/lineups). Đội hình dự kiến (is_projected) vẫn dùng, nhưng hỏi lại đến khi chính thức. */
    async fetchLineups(o) {
        this.lineupNext = Date.now() + LINEUP_RETRY_MS;
        const d = await this.request(o.apiKey, '/lineups?match_id=' + encodeURIComponent(o.matchId));
        if (this.opts !== o) return;
        const teamsOf = (x) => {
            if (!x) return {};
            if (x.home || x.away) return { home: x.home, away: x.away };
            if (Array.isArray(x.teams)) return { home: x.teams[0], away: x.teams[1] };
            if (x.lineups) return teamsOf(x.lineups);
            return {};
        };
        const T = teamsOf(d);
        const starting = (t) => (t && (t.starting || t.startXI || t.players)) || [];
        // API có thể chỉ có đội hình 1 đội (đội kia rỗng) → vẫn cập nhật đội có dữ liệu, hỏi lại đến khi đủ 2 đội
        const has = (t) => starting(t).length >= 11;
        if (!has(T.home) && !has(T.away)) return;
        this.lineupFinal = !d.is_projected && has(T.home) && has(T.away);
        const sig = JSON.stringify([d.is_projected, this.swap, starting(T.home).map((p) => p.id || p.name), starting(T.away).map((p) => p.id || p.name)]);
        if (sig === this.lineupSig) return;
        this.lineupSig = sig;
        const fmt = (f) => { const s = String(f || '').replace(/[^0-9]/g, ''); return s ? s.split('').join('-') : ''; };
        const total = (f) => f.split('-').reduce((a, b) => a + Number(b), 0);
        const line = (p) => [p.number || '', String(p.name || '').toUpperCase()].join('|');
        const ORDER = { goalkeeper: 0, defender: 1, midfielder: 2, attacker: 3, forward: 3 };
        const rank = (p) => { const r = ORDER[String(p.position || '').toLowerCase()]; return r == null ? 9 : r; };
        // Số sơ đồ của API đôi khi không khớp vị trí thật → đếm hậu vệ - tiền vệ - tiền đạo
        const byPos = (xi) => {
            const c = [1, 2, 3].map((r) => xi.filter((p) => rank(p) === r).length);
            return xi.every((p) => rank(p) < 9) && c[0] + c[1] + c[2] === 10 ? c.filter(Boolean).join('-') : '';
        };
        [['home', T.home], ['away', T.away]].forEach(([apiSide, t]) => {
            if (!has(t)) return;
            const f = t.formation || (d.formation && typeof d.formation === 'object' ? d.formation[apiSide] : d.formation);
            const xi = starting(t).slice().sort((a, b) => rank(a) - rank(b));   // sort ổn định: giữ thứ tự trong cùng tuyến
            // Sơ đồ API (vd. 4312) khớp số hậu vệ → giữ (chi tiết hơn); không thì đếm theo vị trí
            const api = fmt(f), pos = byPos(xi);
            const formation = api && total(api) === 10 && (!pos || api.split('-')[0] === pos.split('-')[0]) ? api : pos || api;
            this.emit('cmd', 'setLineup', (apiSide === 'home') !== this.swap ? 'home' : 'away', {
                formation,
                coach: String(nameOf(t.coach)).toUpperCase(),
                players: xi.map(line),
                subs: (t.subs || t.substitutes || []).map(line)
            });
        });
        const miss = ['home', 'away'].filter((s) => !has(T[s])).map((s) => (s === 'home') !== this.swap ? 'nhà' : 'khách');
        console.log('  [Live] đã cập nhật đội hình' + (d.is_projected ? ' (dự kiến)' : '') + (miss.length ? ` — API chưa có đội ${miss.join(', ')}, giữ đội hình nhập tay` : ''));
    }
}

module.exports = { LiveStats };
