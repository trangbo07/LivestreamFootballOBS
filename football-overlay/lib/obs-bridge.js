/* =====================================================================
 *  OBS-BRIDGE.JS — điều khiển OBS qua obs-websocket v5 (có sẵn trong OBS 28+)
 *
 *  • Điều phối 2 camera (cam cận + cam toàn cảnh) trong scene đang phát:
 *      close  — cam cận toàn màn hình
 *      wide   — cam toàn cảnh toàn màn hình
 *      pip    — toàn cảnh full + cam cận khung nhỏ
 *      pip2   — cam cận full + toàn cảnh khung nhỏ
 *      split  — chia đôi màn hình 2 cam
 *      analysis — cam đang phát thu vào khung chế độ phân tích
 *    Cam được trượt / thu phóng mượt (đổi transform), cam không dùng thì ẩn.
 *  • Lấy danh sách scene và chuyển scene.
 *
 *  Bật trong OBS: Tools → WebSocket Server Settings → Enable WebSocket server
 *  Cần Node.js 22+ (có sẵn WebSocket).
 * ===================================================================== */
const { EventEmitter } = require('events');
const crypto = require('crypto');

const sha256b64 = (s) => crypto.createHash('sha256').update(s).digest('base64');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);   // easeInOutCubic

class OBSBridge extends EventEmitter {
    constructor() {
        super();
        this.ws = null;
        this.pending = new Map();
        this.reqId = 0;
        this.status = { state: 'idle', message: 'Chưa kết nối' };
        this.cfg = {};
        this.anim = 0;
    }

    setStatus(s) {
        this.status = Object.assign({ at: Date.now() }, s);
        this.emit('status', this.status);
    }

    note(message) { this.setStatus(Object.assign({}, this.status, { message })); }

    /** cfg: { url, password, cameras:{close, wide}, cameraSource, scene, animateMs } */
    connect(cfg) {
        this.cfg = Object.assign({ url: 'ws://127.0.0.1:4455', password: '', scene: '', animateMs: 900 }, cfg || {});
        this.cfg.cameras = Object.assign({}, this.cfg.cameras || {});
        if (!this.cfg.cameras.close && this.cfg.cameraSource) this.cfg.cameras.close = this.cfg.cameraSource;
        this.disconnect(true);
        if (typeof WebSocket === 'undefined') {
            this.setStatus({ state: 'error', message: 'Node.js quá cũ — cần Node 22+ để nối OBS' });
            return;
        }
        this.setStatus({ state: 'connecting', message: 'Đang kết nối ' + this.cfg.url });
        let ws;
        try { ws = new WebSocket(this.cfg.url, 'obswebsocket.json'); } catch (e) {
            this.setStatus({ state: 'error', message: 'URL OBS không hợp lệ' });
            return;
        }
        this.ws = ws;
        ws.onmessage = (ev) => this.onMessage(JSON.parse(ev.data));
        ws.onerror = () => { /* onclose xử lý */ };
        ws.onclose = (ev) => {
            if (this.ws !== ws) return;
            this.ws = null;
            const msg = ev.code === 4009 ? 'Sai mật khẩu OBS WebSocket' : 'Không kết nối được OBS (OBS đã mở và bật WebSocket chưa?)';
            this.setStatus({ state: 'error', message: msg });
        };
    }

    disconnect(silent) {
        if (this.ws) { const w = this.ws; this.ws = null; try { w.close(); } catch (e) { /* ignore */ } }
        if (!silent) this.setStatus({ state: 'idle', message: 'Đã ngắt OBS' });
    }

    onMessage(m) {
        if (m.op === 0) {                                // Hello
            const d = { rpcVersion: 1 };
            const a = m.d.authentication;
            if (a) d.authentication = sha256b64(sha256b64(this.cfg.password + a.salt) + a.challenge);
            this.ws.send(JSON.stringify({ op: 1, d }));
        } else if (m.op === 2) {                         // Identified
            const c = this.cfg.cameras;
            this.setStatus({ state: 'connected', message: 'Đã kết nối OBS', cameras: c });
            this.emit('ready');
        } else if (m.op === 7) {                         // RequestResponse
            const p = this.pending.get(m.d.requestId);
            if (!p) return;
            this.pending.delete(m.d.requestId);
            if (m.d.requestStatus.result) p.resolve(m.d.responseData || {});
            else p.reject(new Error(m.d.requestStatus.comment || ('Lỗi OBS ' + m.d.requestStatus.code)));
        }
    }

    request(requestType, requestData) {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.status.state !== 'connected') return reject(new Error('Chưa kết nối OBS'));
            const requestId = 'r' + (++this.reqId);
            this.pending.set(requestId, { resolve, reject });
            this.ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
            setTimeout(() => {
                if (this.pending.has(requestId)) { this.pending.delete(requestId); reject(new Error('OBS không phản hồi')); }
            }, 4000);
        });
    }

    /* ---------------- Scene ---------------- */
    async currentScene() {
        if (this.cfg.scene) return this.cfg.scene;
        const r = await this.request('GetCurrentProgramScene');
        return r.sceneName || r.currentProgramSceneName;
    }

    async listScenes() {
        const r = await this.request('GetSceneList');
        const current = r.currentProgramSceneName || r.currentProgramScene;
        return { current, scenes: (r.scenes || []).map((s) => s.sceneName).reverse() };
    }

    async setScene(name) {
        await this.request('SetCurrentProgramScene', { sceneName: name });
        this.note('Đã chuyển scene: ' + name);
    }

    /* ---------------- Camera ---------------- */
    /** Hình chữ nhật đang hiển thị (góc trên trái + kích thước) từ transform OBS. */
    static rectOf(t) {
        const w = t.width, h = t.height;
        const al = t.alignment;
        const x = t.positionX - ((al & 1) ? 0 : (al & 2) ? w : w / 2);
        const y = t.positionY - ((al & 4) ? 0 : (al & 8) ? h : h / 2);
        return { x, y, w, h };
    }

    async setRect(item, r) {
        await this.request('SetSceneItemTransform', {
            sceneName: item.sceneName,
            sceneItemId: item.sceneItemId,
            sceneItemTransform: {
                alignment: 5, positionX: r.x, positionY: r.y,
                boundsType: 'OBS_BOUNDS_SCALE_INNER', boundsAlignment: 0,
                boundsWidth: Math.max(1, r.w), boundsHeight: Math.max(1, r.h)
            }
        });
    }

    /** Trượt nhiều camera cùng lúc. moves = [{ item, from, to }] */
    async animateMany(moves, ms, id) {
        const steps = Math.max(1, Math.round(ms / 33));
        for (let i = 1; i <= steps; i++) {
            if (id !== this.anim) return false;
            const k = ease(i / steps);
            await Promise.all(moves.map((m) => this.setRect(m.item, {
                x: m.from.x + (m.to.x - m.from.x) * k, y: m.from.y + (m.to.y - m.from.y) * k,
                w: m.from.w + (m.to.w - m.from.w) * k, h: m.from.h + (m.to.h - m.from.h) * k
            })));
            await sleep(16);
        }
        return true;
    }

    /**
     * Áp bố cục camera.
     * @param layout  close | wide | pip | pip2 | split | analysis
     * @param active  cam chính khi ở chế độ analysis ('close' | 'wide')
     * @param R       { pip, left, right, analysis } — các khung (x,y,w,h)
     */
    applyCameras(layout, active, R) {
        // Chạy tuần tự: lệnh mới nhất thắng, lệnh đang chạy bị ngắt hiệu ứng
        this.nextJob = { layout, active, R };
        this.anim++;
        if (this.running) return;
        this.running = true;
        (async () => {
            while (this.nextJob) {
                const j = this.nextJob;
                this.nextJob = null;
                await this.runCameras(j.layout, j.active, j.R);
            }
            this.running = false;
        })();
    }

    async runCameras(layout, active, R) {
        if (this.status.state !== 'connected') return;
        const names = this.cfg.cameras || {};
        if (!names.close && !names.wide) return;
        const id = this.anim;
        try {
            const sceneName = await this.currentScene();
            const video = await this.request('GetVideoSettings');
            const F = { x: 0, y: 0, w: video.baseWidth, h: video.baseHeight };

            const items = {};
            for (const role of ['close', 'wide']) {
                if (!names[role]) continue;
                try {
                    const { sceneItemId } = await this.request('GetSceneItemId', { sceneName, sourceName: names[role] });
                    items[role] = { sceneName, sceneItemId };
                } catch (e) { /* source không có trong scene này */ }
            }
            const roles = Object.keys(items);
            if (!roles.length) throw new Error(`Không thấy source "${names.close || names.wide}" trong scene "${sceneName}"`);

            const plans = {
                close: { close: F, wide: null },
                wide: { wide: F, close: null },
                pip: { wide: F, close: R.pip },
                pip2: { close: F, wide: R.pip },
                split: { close: R.left, wide: R.right },
                analysis: active === 'wide' ? { wide: R.analysis, close: null } : { close: R.analysis, wide: null }
            };
            let plan = Object.assign({}, plans[layout] || plans.close);
            // Chỉ có 1 cam → cam đó nhận khung lớn nhất trong bố cục
            if (roles.length === 1) {
                const only = roles[0];
                const rects = Object.values(plan).filter(Boolean).sort((a, b) => b.w * b.h - a.w * a.h);
                plan = { [only]: layout === 'analysis' ? R.analysis : (rects[0] || F) };
            }

            // Trạng thái hiện tại
            const cur = {};
            for (const role of roles) {
                const { sceneItemTransform } = await this.request('GetSceneItemTransform', items[role]);
                const { sceneItemEnabled } = await this.request('GetSceneItemEnabled', items[role]);
                cur[role] = { rect: OBSBridge.rectOf(sceneItemTransform), on: sceneItemEnabled };
            }

            // PiP: khung nhỏ phải nằm TRÊN khung lớn (chỉ đổi chỗ 2 cam, overlay vẫn ở trên cùng)
            if ((layout === 'pip' || layout === 'pip2') && roles.length === 2) {
                const small = layout === 'pip' ? 'close' : 'wide';
                const big = small === 'close' ? 'wide' : 'close';
                const si = (await this.request('GetSceneItemIndex', items[small])).sceneItemIndex;
                const bi = (await this.request('GetSceneItemIndex', items[big])).sceneItemIndex;
                if (si < bi) await this.request('SetSceneItemIndex', Object.assign({}, items[small], { sceneItemIndex: bi }));
            }

            // 1) Cam sắp xuất hiện: đặt sẵn vị trí rồi bật (không bị khung đen)
            const moves = [];
            for (const role of roles) {
                const target = plan[role];
                if (!target) continue;
                if (!cur[role].on) {
                    await this.setRect(items[role], target);
                    await this.request('SetSceneItemEnabled', Object.assign({}, items[role], { sceneItemEnabled: true }));
                } else {
                    moves.push({ item: items[role], from: cur[role].rect, to: target });
                }
            }
            // 2) Trượt / thu phóng các cam đang hiện
            const done = await this.animateMany(moves, this.cfg.animateMs || 900, id);
            if (!done) return;
            // 3) Ẩn cam không dùng
            for (const role of roles) {
                if (!plan[role] && cur[role].on) {
                    await this.request('SetSceneItemEnabled', Object.assign({}, items[role], { sceneItemEnabled: false }));
                }
            }
            const label = { close: 'Cam cận', wide: 'Cam toàn cảnh', pip: 'PiP (toàn cảnh + cam cận)', pip2: 'PiP (cam cận + toàn cảnh)', split: 'Chia đôi 2 cam', analysis: 'Chế độ phân tích' }[layout] || layout;
            this.note('Camera: ' + label);
        } catch (e) {
            this.note('Lỗi camera: ' + e.message);
        }
    }
}

module.exports = { OBSBridge };
