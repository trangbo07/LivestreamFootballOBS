/* =====================================================================
 *  SERVER.JS — máy chủ nhỏ, KHÔNG cần cài thư viện (chỉ cần Node.js 18+;
 *  Node 22+ nếu muốn tự thu nhỏ camera trong OBS)
 *
 *  Vai trò:
 *   1. Chuyển lệnh giữa control.html và overlay trong OBS (SSE).
 *   2. Đọc bình luận YouTube Live và đẩy lên khung chat overlay.
 *   3. (Tuỳ chọn) Điều khiển OBS: thu nhỏ camera khi bật chế độ phân tích.
 *
 *    node server.js            → http://localhost:3000
 *    PORT=4000 node server.js  → đổi cổng
 *
 *  Endpoint:
 *    GET  /events              SSE stream (overlay + control đều nghe)
 *    POST /api/send            chuyển tiếp 1 tin nhắn Bus (dùng nội bộ)
 *    POST /api/cmd             gọi API overlay từ bên ngoài: {"fn":"goal","args":[{"team":"home"}]}
 *    GET  /api/state           trạng thái overlay gần nhất (JSON)
 *    POST /api/youtube/start   {"source":"link live / ID / @kênh", "apiKey":""}
 *    POST /api/youtube/stop
 *    GET  /api/youtube/status
 *    POST /api/obs/connect     {"url","password","cameraSource","scene"}
 *    POST /api/obs/disconnect
 *    GET  /api/obs/scenes      danh sách scene ;  POST /api/obs/scene {"name"} chuyển scene
 *    GET  /api/obs/status
 *    POST /api/photo/upload    {"data":"data:image/jpeg;base64,..."} → {"url":"uploads/..."}
 *    POST /api/obs/snapshot    {"camera":"close"|"wide"} chụp camera trong OBS → {"url"}
 *    POST /api/live/search     {"apiKey","q","date"} tìm trận (live-football-api.com)
 *    POST /api/live/start      {"apiKey","matchId","league","interval","swap","popups"} tự cập nhật
 *                              tỷ số, thống kê, sự kiện, đội, logo, đội hình, sa bàn
 *    POST /api/live/stop ;  GET /api/live/status
 *    POST /api/ai/config       {"apiKey","model","enabled","onlyQuestions"} trợ lý AI (OpenAI)
 *    POST /api/ai/ask          {"user","text"} thử 1 câu ;  GET /api/ai/status ;  GET /api/ai/history
 * ===================================================================== */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const { YouTubeChat } = require('./lib/youtube-chat');
const { OBSBridge } = require('./lib/obs-bridge');
const { LiveStats } = require('./lib/live-stats');
const { AIAssistant } = require('./lib/ai-assistant');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const MAX_BODY = 8 * 1024 * 1024;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf'
};

/** Đọc js/config.js (file của trình duyệt) để server dùng chung cấu hình. */
function loadConfig() {
    try {
        const code = fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8');
        const sandbox = { window: {} };
        vm.runInNewContext(code, sandbox, { timeout: 1000 });
        return sandbox.window.CONFIG || {};
    } catch (e) {
        console.error('  ! Không đọc được js/config.js:', e.message);
        return {};
    }
}

/** Dấu vân tay của config.js — giống hệt cách overlay tính (hash JSON của CONFIG).
 *  Dùng để nhận ra overlay đang chạy cấu hình cũ (chưa refresh).            */
let fpCache = { mtime: 0, value: '' };
function configFingerprint() {
    try {
        const mtime = fs.statSync(path.join(ROOT, 'js', 'config.js')).mtimeMs;
        if (mtime !== fpCache.mtime) {
            const s = JSON.stringify(loadConfig());
            let h = 0;
            for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
            fpCache = { mtime, value: String(Math.abs(h)) };
        }
    } catch (e) { /* giữ giá trị cũ */ }
    return fpCache.value;
}
const staleWarned = new Set();

// Lỗi bất ngờ (vd. mạng YouTube / OBS) không được làm sập server khi đang live
process.on('uncaughtException', (e) => console.error('  ! Lỗi:', e && e.message));
process.on('unhandledRejection', (e) => console.error('  ! Lỗi:', e && e.message));

/* ---------------- SSE / BUS ---------------- */
const clients = new Set();
let lastState = null;          // tin "state" gần nhất — gửi lại cho client mới kết nối
const retained = {};           // trạng thái YouTube / OBS gần nhất

const newId = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function broadcast(msg) {
    const data = `data: ${JSON.stringify(msg)}\n\n`;
    for (const res of clients) res.write(data);
}

function sendBus(type, payload) {
    const msg = { id: newId('srv'), from: 'server', type, payload, ts: Date.now() };
    if (type === 'yt-status' || type === 'obs-status' || type === 'live-status' || type === 'ai-status') retained[type] = msg;
    broadcast(msg);
}

const cmd = (fn, ...args) => sendBus('cmd', { fn, args });

/* ---------------- YOUTUBE ---------------- */
const yt = new YouTubeChat();
yt.on('status', (s) => {
    sendBus('yt-status', s);
    const txt = s.state === 'live' ? `đang nhận chat: ${s.title || s.videoId}` : s.message;
    console.log(`  [YouTube] ${txt}`);
});
yt.on('message', (m) => {
    cmd('chat', {
        user: m.user, avatar: m.avatar, parts: m.parts, text: m.text,
        badge: m.badge, amount: m.amount, kind: m.kind, source: 'youtube'
    });
    ai.push(m);
});
// Đếm số tin gửi lại cho control mỗi 5 giây
setInterval(() => {
    if (yt.status.state === 'live') sendBus('yt-status', Object.assign({}, yt.status, { count: yt.count }));
}, 5000);

/* ---------------- TRỢ LÝ AI (OpenAI) ----------------
 * Dịch bình luận YouTube sang tiếng Việt + gợi ý câu trả lời tiếng Anh đơn giản.
 * Key lưu trong .ai-assistant.json (không đưa lên git, không gửi lại trình duyệt). */
const AI_SAVE = path.join(ROOT, '.ai-assistant.json');
const ai = new AIAssistant();
function loadAiSettings() {
    try { return JSON.parse(fs.readFileSync(AI_SAVE, 'utf8')); } catch (e) { return {}; }
}
ai.configure(loadAiSettings());
ai.context = () => {
    const C = loadConfig();
    const p = (lastState && lastState.payload) || {};
    const h = p.home || C.homeTeam || {}, a = p.away || C.awayTeam || {}, sc = p.score || { home: 0, away: 0 };
    const c = p.clock || {};
    const min = Math.floor(((c.base || 0) + (c.running && c.anchor ? (Date.now() - c.anchor) / 1000 : 0)) / 60);
    const match = h.name && a.name ? `${h.name} ${sc.home} - ${sc.away} ${a.name}` + (p.period ? `, ${p.period} ${min}'` : '') : '';
    return { channel: C.channelName || 'our channel', match };
};
ai.on('status', (s) => {
    sendBus('ai-status', s);
    if (s.state === 'error') console.log('  [AI] ' + s.message);
});
ai.on('reply', (item) => sendBus('ai-reply', item));

/* ---------------- OBS ---------------- */
const obs = new OBSBridge();
obs.on('status', (s) => {
    sendBus('obs-status', s);
    console.log(`  [OBS] ${s.message}`);
});
/* ---------------- ĐIỀU PHỐI CAMERA ----------------
 * Bố cục cam nằm trong state overlay (state.cam.layout) để overlay vẽ
 * khung/nhãn khớp với vị trí camera thật. Server thấy state đổi → OBS.  */
let lastCamKey = null;
const MAIN_CAM = { close: 'close', wide: 'wide', pip: 'wide', pip2: 'close', split: 'close', photo: 'close', photo2: 'wide' };

function camRects() {
    const C = loadConfig();
    const R = Object.assign({}, (C.cameras && C.cameras.rects) || {});
    return {
        pip: R.pip || { x: 1452, y: 64, w: 408, h: 230 },
        left: R.left || { x: 40, y: 150, w: 912, h: 513 },
        right: R.right || { x: 968, y: 150, w: 912, h: 513 },
        analysis: Object.assign({ x: 250, y: 64, w: 1100, h: 619 }, (C.analysis || {}).camera || {}),
        heatbig: Object.assign({ x: 1390, y: 56, w: 470, h: 264 }, (C.analysis || {}).cameraSmall || {})
    };
}

function effectiveCam(state) {
    const camLayout = (state.cam && state.cam.layout) || 'close';
    if (state.layout === 'trackbig') return { layout: 'heatbig', active: MAIN_CAM[camLayout] || 'close' };   // cùng khung cam nhỏ
    return state.layout === 'analysis' || state.layout === 'heatbig'
        ? { layout: state.layout, active: MAIN_CAM[camLayout] || 'close' }
        : { layout: camLayout, active: MAIN_CAM[camLayout] || 'close' };
}

/* Bật chế độ phân tích → chuyển sang scene riêng (vd. "Scene 2"), tắt → quay về.
 * Cấu hình trong control: camAuto.sceneAnalysis / camAuto.sceneNormal.        */
let lastAnalysis = null;
let sceneBeforeAnalysis = null;

async function switchAnalysisScene(on, A) {
    try {
        if (on) {
            const { current } = await obs.listScenes();
            sceneBeforeAnalysis = current;
            if (current !== A.sceneAnalysis) await obs.setScene(A.sceneAnalysis);
        } else {
            const back = A.sceneNormal || sceneBeforeAnalysis;
            sceneBeforeAnalysis = null;
            if (back) await obs.setScene(back);
        }
    } catch (e) {
        console.log('  [OBS] Không chuyển được scene: ' + e.message);
    }
}

function watchCameras(state, force) {
    // Bỏ qua overlay phiên bản cũ (chưa có state.cam) — vd. tab trình duyệt chưa refresh
    if (!state || !state.cam) return;
    const A = state.camAuto || {};
    const isAnalysis = state.layout === 'analysis';
    const sceneMode = !!A.sceneAnalysis;

    // Đổi scene cùng lúc với bật / tắt chế độ phân tích
    if (lastAnalysis !== null && isAnalysis !== lastAnalysis && (sceneMode || sceneBeforeAnalysis)) {
        switchAnalysisScene(isAnalysis, A);
    }
    lastAnalysis = isAnalysis;

    // Dùng scene riêng cho phân tích → không thu nhỏ camera (scene đó tự bố trí)
    const e = isAnalysis && sceneMode ? { layout: 'scene', active: '' } : effectiveCam(state);
    const key = e.layout + ':' + e.active;
    if (!force && key === lastCamKey) return;
    const prevKey = lastCamKey;
    lastCamKey = key;
    if (prevKey === null && !force) return;     // lần đầu chỉ ghi nhận, không xoay camera
    if (e.layout === 'scene') return;
    if (prevKey === 'scene:' && !force) return; // vừa quay về scene cũ: camera ở đó vẫn nguyên
    obs.applyCameras(e.layout, e.active, camRects());
}
obs.on('ready', () => { if (lastState) watchCameras(lastState.payload, true); });

/* Tự chuyển cam theo sự kiện overlay (hiện đội hình, bàn thắng, HT, FT).
 * Quy tắc lấy từ state.camAuto (chỉnh trong control panel).            */
let camRestore = null, holdTimer = null;
const lastEventAt = {};

function setCam(layout) {
    console.log('  [Cam] tự chuyển → ' + layout);
    cmd('setCamLayout', layout, { auto: true });
}
function restoreCam() {
    clearTimeout(holdTimer);
    if (camRestore) { setCam(camRestore); camRestore = null; }
}
function tempCam(layout, ms) {
    const st = lastState && lastState.payload;
    const cur = (st && st.cam && st.cam.layout) || 'close';
    if (cur !== layout) {
        if (!camRestore) camRestore = cur;
        setCam(layout);
    }
    clearTimeout(holdTimer);
    if (ms > 0) holdTimer = setTimeout(restoreCam, ms);
}

function onOverlayEvent(ev) {
    const st = lastState && lastState.payload;
    if (!st || !ev || !ev.name) return;
    const now = Date.now();
    if (now - (lastEventAt[ev.name] || 0) < 1500) return;      // nhiều overlay cùng báo → chỉ xử lý 1 lần
    lastEventAt[ev.name] = now;
    console.log('  [Sự kiện] ' + ev.name);
    const A = st.camAuto || {};
    if (A.enabled === false) return;
    switch (ev.name) {
        case 'lineup-show': if (A.lineup) tempCam(A.lineup, 0); break;
        case 'lineup-hide': if (A.lineup) restoreCam(); break;
        case 'goal': if (A.goal) tempCam(A.goal, (Number(A.goalHold) || 8) * 1000); break;
        case 'halftime': if (A.halfTime) { camRestore = null; setCam(A.halfTime); } break;
        case 'fulltime': if (A.fullTime) { camRestore = null; setCam(A.fullTime); } break;
        case 'matchstart': if (A.matchStart) { camRestore = null; setCam(A.matchStart); } break;
    }
}

/* ---------------- GHI NHỚ KẾT NỐI OBS ----------------
 * Lưu thông số lần "Kết nối OBS" gần nhất (địa chỉ, mật khẩu, tên camera)
 * → khởi động lại server sẽ tự kết nối lại, camera vẫn tự thu nhỏ / phóng to. */
const OBS_SAVE = path.join(ROOT, '.obs-connection.json');

function saveObsConnection(body) {
    try {
        if (body) fs.writeFileSync(OBS_SAVE, JSON.stringify(body, null, 2));
        else if (fs.existsSync(OBS_SAVE)) fs.unlinkSync(OBS_SAVE);
    } catch (e) { console.log('  [OBS] không lưu được thông số kết nối: ' + e.message); }
}

function loadObsConnection() {
    try { return JSON.parse(fs.readFileSync(OBS_SAVE, 'utf8')); } catch (e) { return null; }
}

/* ---------------- DỮ LIỆU TRẬN TỰ ĐỘNG (live-football-api.com) ----------------
 * Lưu key + trận đang theo dõi vào .live-stats.json (không đưa lên git). */
const LIVE_SAVE = path.join(ROOT, '.live-stats.json');
const live = new LiveStats();

function loadLiveSettings() {
    try { return JSON.parse(fs.readFileSync(LIVE_SAVE, 'utf8')); } catch (e) { return {}; }
}
function saveLiveSettings(patch) {
    const s = Object.assign(loadLiveSettings(), patch);
    try { fs.writeFileSync(LIVE_SAVE, JSON.stringify(s, null, 2)); } catch (e) { console.log('  [Live] không lưu được cài đặt: ' + e.message); }
    return s;
}
/** Nhận key mới (nếu có) rồi trả về key đã lưu. */
function liveKey(body) {
    if (body && body.apiKey) saveLiveSettings({ lfaKey: String(body.apiKey).trim() });
    const k = loadLiveSettings().lfaKey;
    if (!k) throw new Error('Chưa nhập key Live Football API');
    return k;
}
/** Cài đặt gửi cho control — không bao giờ gửi lại key. */
function livePublic() {
    const s = loadLiveSettings();
    return Object.assign({}, live.status, {
        hasKey: !!s.lfaKey,
        settings: { matchId: s.matchId || '', label: s.label || '', league: s.league || '', interval: s.interval || 15, swap: s.swap == null ? 'auto' : s.swap, popups: s.popups !== false }
    });
}
live.on('status', (s) => {
    if (s.state === 'done' && loadLiveSettings().running) saveLiveSettings({ running: false });   // hết trận → không tự chạy lại
    sendBus('live-status', livePublic());
    console.log('  [Live] ' + (s.message || s.state));
});
live.on('cmd', (fn, ...args) => cmd(fn, ...args));

function startLive(s) {
    const st = (lastState && lastState.payload) || {};
    const C = loadConfig();   // overlay chưa gửi state (vừa bật server) → dùng tên đội trong config.js
    const nameOf = (t) => (t && t.name) || '';
    live.start(Object.assign({}, s, {
        apiKey: s.lfaKey,
        homeName: nameOf(st.home) || nameOf(C.homeTeam),
        awayName: nameOf(st.away) || nameOf(C.awayTeam)
    }));
}
// Server khởi động lại giữa trận → tự chạy tiếp (đợi overlay gửi state để nhận đúng đội nhà)
setTimeout(() => {
    const s = loadLiveSettings();
    if (s.running && s.lfaKey && s.matchId) { console.log('  [Live] tự chạy tiếp trận ' + s.matchId); startLive(s); }
}, 4000);

/* ---------------- ẢNH TRẬN ĐẤU ----------------
 * Lưu ảnh (dataURL) vào thư mục uploads/ → overlay chỉ cần giữ đường dẫn ngắn. */
const UPLOAD_DIR = path.join(ROOT, 'uploads');

function savePhoto(dataUrl) {
    const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/i.exec(String(dataUrl || ''));
    if (!m) throw new Error('Ảnh không hợp lệ (chỉ nhận PNG / JPG / WEBP)');
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const ext = m[1].toLowerCase() === 'png' ? 'png' : m[1].toLowerCase() === 'webp' ? 'webp' : 'jpg';
    const name = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(m[2], 'base64'));
    console.log('  [Ảnh] đã lưu uploads/' + name);
    return 'uploads/' + name;
}

/* ---------------- HTTP ---------------- */
function readBody(req) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', (c) => {
            size += c.length;
            if (size > MAX_BODY) { reject(new Error('Body too large')); req.destroy(); return; }
            chunks.push(c);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

async function readJson(req) {
    const txt = await readBody(req);
    return txt ? JSON.parse(txt) : {};
}

function json(res, code, obj) {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(obj));
}

function serveStatic(req, res, pathname) {
    let rel = decodeURIComponent(pathname);
    if (rel === '/' || rel === '') rel = '/index.html';
    const file = path.normalize(path.join(ROOT, rel));
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
    // Không phục vụ mã nguồn server / file lưu nội bộ
    if (/^[\\/](lib[\\/]|\.obs-camera\.json$|\.obs-connection\.json$|\.live-stats\.json$|\.ai-assistant\.json$|server\.js$)/.test(file.slice(ROOT.length))) { res.writeHead(404); return res.end('Not found'); }
    fs.stat(file, (err, st) => {
        if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, {
            'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
            'Cache-Control': 'no-cache'
        });
        fs.createReadStream(file).pipe(res);
    });
}

const server = http.createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');

    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        return res.end();
    }

    if (pathname === '/events') {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });
        res.write('retry: 2000\n\n');
        if (lastState) res.write(`data: ${JSON.stringify(lastState)}\n\n`);
        Object.values(retained).forEach((m) => res.write(`data: ${JSON.stringify(m)}\n\n`));
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
    }

    try {
        if (pathname === '/api/send' && req.method === 'POST') {
            const msg = await readJson(req);
            if (!msg || !msg.id || !msg.type) return json(res, 400, { ok: false, error: 'invalid message' });
            if (msg.type === 'state' && msg.payload) {
                // Overlay chạy config.js cũ (source OBS / tab chưa refresh): KHÔNG nghe theo,
                // nếu không 2 overlay lệch nhau sẽ kéo camera qua lại. Bảo nó tự tải lại.
                const fp = configFingerprint();
                if (fp && msg.payload.fingerprint !== fp) {
                    if (!staleWarned.has(msg.from)) {
                        staleWarned.add(msg.from);
                        console.log(`  [Overlay] Bỏ qua 1 overlay đang chạy cấu hình cũ (${msg.from}) — hãy refresh source đó trong OBS`);
                    }
                    sendBus('stale', { fingerprint: fp, target: msg.from });
                    return json(res, 200, { ok: true, ignored: 'stale config' });
                }
                if (msg.payload.cam) { lastState = msg; watchCameras(msg.payload); }
            }
            if (msg.type === 'event') onOverlayEvent(msg.payload);
            // Người dùng tự chọn cam → huỷ việc tự quay lại cam cũ
            if (msg.type === 'cmd' && msg.payload && msg.payload.fn === 'setCamLayout' && !(msg.payload.args && msg.payload.args[1] && msg.payload.args[1].auto)) {
                camRestore = null;
                clearTimeout(holdTimer);
            }
            broadcast(msg);
            return json(res, 200, { ok: true });
        }

        if (pathname === '/api/cmd' && req.method === 'POST') {
            const body = await readJson(req);
            if (!body || typeof body.fn !== 'string') return json(res, 400, { ok: false, error: 'missing "fn"' });
            const args = Array.isArray(body.args) ? body.args : (body.args === undefined ? [] : [body.args]);
            cmd(body.fn, ...args);
            return json(res, 200, { ok: true, sent: { fn: body.fn, args } });
        }

        if (pathname === '/api/state') return json(res, 200, lastState ? lastState.payload : null);

        /* ----- YouTube ----- */
        if (pathname === '/api/youtube/start' && req.method === 'POST') {
            const body = await readJson(req);
            const C = loadConfig().youtube || {};
            const source = body.source || C.source;
            yt.start(source, { apiKey: body.apiKey != null ? body.apiKey : C.apiKey, maxPerPoll: C.maxPerPoll });
            return json(res, 200, { ok: true });
        }
        if (pathname === '/api/youtube/stop' && req.method === 'POST') {
            yt.stop();
            return json(res, 200, { ok: true });
        }
        if (pathname === '/api/youtube/status') return json(res, 200, Object.assign({}, yt.status, { count: yt.count || 0 }));

        /* ----- OBS ----- */
        if (pathname === '/api/obs/connect' && req.method === 'POST') {
            const body = await readJson(req);
            const C = loadConfig();
            saveObsConnection(body);
            obs.connect(Object.assign({}, C.obs || {}, { cameras: (C.cameras || {}).sources }, body));
            return json(res, 200, { ok: true });
        }
        if (pathname === '/api/obs/disconnect' && req.method === 'POST') {
            saveObsConnection(null);            // chủ động ngắt → lần sau không tự kết nối lại
            obs.disconnect();
            return json(res, 200, { ok: true });
        }
        if (pathname === '/api/obs/status') return json(res, 200, obs.status);
        if (pathname === '/api/obs/scenes') return json(res, 200, await obs.listScenes());
        if (pathname === '/api/obs/scene' && req.method === 'POST') {
            const body = await readJson(req);
            await obs.setScene(body.name);
            return json(res, 200, { ok: true });
        }
        if (pathname === '/api/obs/reapply' && req.method === 'POST') {
            if (lastState) watchCameras(lastState.payload, true);
            return json(res, 200, { ok: true });
        }

        /* ----- Dữ liệu trận tự động (live-football-api.com) ----- */
        if (pathname === '/api/live/status') return json(res, 200, livePublic());
        if (pathname === '/api/live/search' && req.method === 'POST') {
            const body = await readJson(req);
            const list = await live.search(liveKey(body), body.q || '', body.date || new Date().toISOString().slice(0, 10));
            sendBus('live-status', livePublic());
            return json(res, 200, { ok: true, list, credits: live.status.remaining });
        }
        if (pathname === '/api/live/start' && req.method === 'POST') {
            const body = await readJson(req);
            liveKey(body);
            const matchId = String(body.matchId || '').trim();
            if (!/^[a-z0-9]+$/i.test(matchId)) throw new Error('Chưa chọn trận');
            const s = saveLiveSettings({
                matchId, running: true,
                label: String(body.label || ''), league: String(body.league || ''),
                interval: Math.max(10, Number(body.interval) || 15),
                swap: body.swap === true || body.swap === false ? body.swap : 'auto',
                popups: body.popups !== false
            });
            startLive(s);
            return json(res, 200, { ok: true });
        }
        if (pathname === '/api/live/stop' && req.method === 'POST') {
            saveLiveSettings({ running: false });
            live.stop();
            return json(res, 200, { ok: true });
        }

        /* ----- Trợ lý AI ----- */
        if (pathname === '/api/ai/status') return json(res, 200, ai.publicStatus());
        if (pathname === '/api/ai/history') return json(res, 200, { ok: true, list: ai.history });
        if (pathname === '/api/ai/config' && req.method === 'POST') {
            const body = await readJson(req);
            const patch = {};
            if (typeof body.apiKey === 'string' && body.apiKey.trim()) patch.apiKey = body.apiKey.trim();
            if (body.clearKey) patch.apiKey = '';
            if (typeof body.model === 'string' && body.model.trim()) patch.model = body.model.trim();
            if (typeof body.enabled === 'boolean') patch.enabled = body.enabled;
            if (typeof body.onlyQuestions === 'boolean') patch.onlyQuestions = body.onlyQuestions;
            const saved = Object.assign(loadAiSettings(), patch);
            try { fs.writeFileSync(AI_SAVE, JSON.stringify(saved, null, 2)); } catch (e) { console.log('  [AI] không lưu được cài đặt: ' + e.message); }
            ai.configure(saved);
            return json(res, 200, Object.assign({ ok: true }, ai.publicStatus()));
        }
        if (pathname === '/api/ai/ask' && req.method === 'POST') {
            const body = await readJson(req);
            if (!ai.settings.apiKey) throw new Error('Chưa nhập OpenAI API key');
            ai.push({ user: body.user || 'Test', text: body.text || '' }, true);
            return json(res, 200, { ok: true });
        }

        /* ----- Khung ảnh trận đấu ----- */
        if (pathname === '/api/photo/upload' && req.method === 'POST') {
            const body = await readJson(req);
            return json(res, 200, { ok: true, url: savePhoto(body.data) });
        }
        if (pathname === '/api/obs/snapshot' && req.method === 'POST') {
            const body = await readJson(req);
            const role = body.camera === 'wide' ? 'wide' : 'close';
            const sourceName = body.source || (obs.cfg.cameras || {})[role] || ((loadConfig().cameras || {}).sources || {})[role];
            if (!sourceName) throw new Error('Chưa đặt tên source camera trong OBS');
            const r = await obs.request('GetSourceScreenshot', { sourceName, imageFormat: 'jpg', imageWidth: 1600, imageCompressionQuality: 88 });
            return json(res, 200, { ok: true, url: savePhoto(r.imageData) });
        }
    } catch (e) {
        return json(res, 400, { ok: false, error: e.message });
    }

    if (req.method === 'GET') return serveStatic(req, res, pathname);
    res.writeHead(405);
    res.end();
});

// Giữ kết nối SSE sống (một số proxy/OBS cắt kết nối im lặng)
setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 15000);

server.listen(PORT, '0.0.0.0', () => {
    const ips = Object.values(os.networkInterfaces()).flat()
        .filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
    console.log('');
    console.log('  ⚽  FOOTBALL OVERLAY SERVER');
    console.log('  ------------------------------------------------');
    console.log(`  Overlay (OBS):   http://localhost:${PORT}/`);
    console.log(`  Control panel:   http://localhost:${PORT}/control.html`);
    console.log(`  Trợ lý AI:       http://localhost:${PORT}/assistant.html`);
    ips.forEach((ip) => console.log(`  Từ máy khác/điện thoại: http://${ip}:${PORT}/control.html`));
    console.log('  ------------------------------------------------');
    console.log('  Ctrl+C để dừng.');
    console.log('');

    const C = loadConfig();
    if (C.youtube && C.youtube.autoConnect && C.youtube.source) {
        yt.start(C.youtube.source, { apiKey: C.youtube.apiKey, maxPerPoll: C.youtube.maxPerPoll });
    }
    const saved = loadObsConnection();
    if (saved) {
        console.log('  [OBS] tự kết nối lại theo lần kết nối trước');
        obs.connect(Object.assign({}, C.obs || {}, { cameras: (C.cameras || {}).sources }, saved));
    } else if (C.obs && C.obs.enabled) obs.connect(Object.assign({}, C.obs, { cameras: (C.cameras || {}).sources }));
});
