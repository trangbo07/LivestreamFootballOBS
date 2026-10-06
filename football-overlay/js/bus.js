/* =====================================================================
 *  BUS.JS — kênh giao tiếp giữa control.html và index.html (overlay)
 *
 *  3 đường truyền chạy song song, tin nhắn được khử trùng lặp theo id:
 *   1. Server SSE  (khi mở qua http://localhost:3000 — dùng cho OBS)
 *   2. BroadcastChannel (cùng trình duyệt / cùng OBS)
 *   3. localStorage "storage" event (dự phòng cho file://)
 *
 *  Định dạng tin nhắn: { id, from, type, payload, ts }
 *    type "cmd"   → payload { fn, args }  — gọi Overlay[fn](...args)
 *    type "state" → payload = trạng thái overlay (để control hiển thị)
 *    type "hello" → control hỏi trạng thái, overlay trả lời "state"
 * ===================================================================== */
(function () {
    'use strict';

    const CHANNEL = 'football-overlay-v1';
    const myId = Math.random().toString(36).slice(2, 10);
    const listeners = [];
    const seenSet = new Set();
    const seenList = [];
    const isHttp = location.protocol === 'http:' || location.protocol === 'https:';

    let serverConnected = false;
    let bc = null;

    function markSeen(id) {
        seenSet.add(id);
        seenList.push(id);
        if (seenList.length > 400) seenSet.delete(seenList.shift());
    }

    function deliver(msg) {
        if (!msg || !msg.id || seenSet.has(msg.id)) return;
        markSeen(msg.id);
        if (msg.from === myId) return;
        for (const fn of listeners) {
            try { fn(msg); } catch (err) { console.error('[Bus] listener error', err); }
        }
    }

    /* 1. BroadcastChannel */
    try {
        bc = new BroadcastChannel(CHANNEL);
        bc.onmessage = (e) => deliver(e.data);
    } catch (e) { bc = null; }

    /* 2. localStorage event */
    window.addEventListener('storage', (e) => {
        if (e.key !== CHANNEL || !e.newValue) return;
        try { deliver(JSON.parse(e.newValue)); } catch (err) { /* ignore */ }
    });

    /* 3. Server-Sent Events */
    function connectServer() {
        if (!isHttp || typeof EventSource === 'undefined') return;
        let everOpened = false;
        const es = new EventSource('/events');
        es.onopen = () => { everOpened = true; serverConnected = true; emitStatus(); };
        es.onmessage = (e) => { try { deliver(JSON.parse(e.data)); } catch (err) { /* ignore */ } };
        es.onerror = () => {
            serverConnected = false;
            emitStatus();
            // Không phải server của dự án này (vd. Live Server) → thôi thử lại
            if (!everOpened) es.close();
        };
    }

    const statusListeners = [];
    function emitStatus() { statusListeners.forEach((fn) => fn(Bus.status())); }

    function send(type, payload) {
        const msg = {
            id: myId + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
            from: myId, type, payload, ts: Date.now()
        };
        markSeen(msg.id);
        if (bc) { try { bc.postMessage(msg); } catch (e) { /* ignore */ } }
        try { localStorage.setItem(CHANNEL, JSON.stringify(msg)); } catch (e) { /* quota / privacy */ }
        if (isHttp && serverConnected) {
            fetch('/api/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(msg)
            }).catch(() => { /* ignore */ });
        }
        return msg;
    }

    const Bus = {
        id: myId,
        send,
        on(fn) { listeners.push(fn); },
        onStatus(fn) { statusListeners.push(fn); fn(Bus.status()); },
        status() { return { server: serverConnected, http: isHttp, broadcast: !!bc }; }
    };

    /* Tiện ích dùng chung */
    const Util = {
        esc(s) {
            return String(s == null ? '' : s)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        },
        pad(n) { return String(n).padStart(2, '0'); },
        clamp(n, a, b) { return Math.max(a, Math.min(b, n)); },
        pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
        rand(a, b) { return a + Math.random() * (b - a); },
        hash(str) {
            let h = 0;
            for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
            return Math.abs(h);
        },
        /** Thu nhỏ chữ cho vừa khung (chỉ chạy khi nội dung đổi). */
        fitText(el, max, min) {
            let size = max;
            el.style.fontSize = size + 'px';
            while (el.scrollWidth > el.clientWidth + 1 && size > min) {
                size -= 2;
                el.style.fontSize = size + 'px';
            }
        }
    };

    window.Bus = Bus;
    window.Util = Util;
    connectServer();
})();
