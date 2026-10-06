/* =====================================================================
 *  CHAT.JS — khung chat: tin mới đẩy từ dưới lên (FLIP animation),
 *  tin cũ tự mờ dần, fake chat cho demo, WebSocket cho chat thật.
 * ===================================================================== */
(function () {
    'use strict';
    const { esc, hash, pick, rand } = window.Util;

    const COLORS = ['#b18cff', '#34d399', '#60a5fa', '#f472b6', '#fbbf24', '#ff7a85', '#22d3ee', '#a3e635', '#fb923c', '#e879f9'];
    let root, list;
    let max = 5;
    let lifetime = 0;
    let fakeTimer = null;
    let fakeOn = false;
    let ws = null;
    let cfg = {};

    function colorFor(name) { return COLORS[hash(String(name).toLowerCase()) % COLORS.length]; }

    /** Đẩy các tin cũ lên mượt mà khi thêm tin mới (First-Last-Invert-Play). */
    function flip(mutate) {
        const kids = Array.from(list.children).filter((k) => !k.classList.contains('cm-leave'));
        const before = new Map(kids.map((k) => [k, k.offsetTop]));
        mutate();
        const moved = [];
        kids.forEach((k) => {
            const d = before.get(k) - k.offsetTop;
            if (d) {
                k.style.transition = 'none';
                k.style.transform = `translateY(${d}px)`;
                moved.push(k);
            }
        });
        if (!moved.length) return;
        void list.offsetHeight;
        moved.forEach((k) => {
            k.style.transition = 'transform .45s cubic-bezier(.16,1,.3,1)';
            k.style.transform = '';
        });
    }

    function removeMsg(el) {
        if (!el.parentNode || el.classList.contains('cm-leave')) return;
        el.classList.add('cm-leave');
        setTimeout(() => el.remove(), 420);
    }

    function trim() {
        const active = Array.from(list.children).filter((k) => !k.classList.contains('cm-leave'));
        const extra = active.length - max;
        for (let i = 0; i < extra; i++) removeMsg(active[i]);
    }

    /**
     * Thêm 1 bình luận.
     * @param {{user:string, text?:string, parts?:Array, avatar?:string, color?:string,
     *          badge?:'owner'|'mod'|'member'|'verified', amount?:string, kind?:string}} msg
     *  parts: [{text}] hoặc [{img, alt}] (emoji riêng của YouTube)
     */
    const BADGE_LABEL = { owner: 'CHỦ KÊNH', mod: 'MOD', member: 'HỘI VIÊN', verified: '✓' };
    const safeUrl = (u) => /^https:\/\//i.test(String(u || '')) ? String(u) : '';

    /** Lọc từ cấm (CONFIG.chat.bannedWords). Trả về null nếu tin bị ẩn. */
    let bannedRe = null;
    function filterText(t) {
        if (!bannedRe) return t;
        bannedRe.lastIndex = 0;              // regex có cờ g → reset trước khi test
        if (cfg.filterMode === 'hide') return bannedRe.test(t) ? null : t;
        return t.replace(bannedRe, (m) => '*'.repeat(m.length));
    }

    function partsHTML(msg) {
        const parts = Array.isArray(msg.parts) && msg.parts.length ? msg.parts : [{ text: msg.text || '' }];
        let out = '';
        for (const p of parts) {
            if (p.img) {
                const u = safeUrl(p.img);
                out += u ? `<img class="cm-emoji" src="${esc(u)}" alt="${esc(p.alt || '')}">` : esc(p.alt || '');
            } else {
                const t = filterText(String(p.text || ''));
                if (t === null) return null;
                out += esc(t);
            }
        }
        return out;
    }

    function add(msg) {
        if (!list || !msg) return;
        if (!msg.text && !(msg.parts && msg.parts.length) && !msg.amount && msg.kind !== 'member') return;
        const body = partsHTML(msg);
        if (body === null) return;                      // dính từ cấm (chế độ ẩn)
        const user = String(msg.user || 'khach').replace(/^@/, '');
        const color = msg.color || colorFor(user);
        const avatar = cfg.showAvatars === false ? '' : safeUrl(msg.avatar);
        const badge = BADGE_LABEL[msg.badge] ? `<span class="cm-badge ${esc(msg.badge)}">${BADGE_LABEL[msg.badge]}</span>` : '';
        const amount = msg.amount ? `<span class="cm-amount">${esc(msg.amount)}</span>` : '';
        const el = document.createElement('div');
        el.className = 'cm' + (msg.amount ? ' cm-super' : '') + (msg.kind === 'member' ? ' cm-member' : '');
        el.innerHTML =
            `<span class="cm-av" style="background:${esc(color)}">${esc(user.charAt(0).toUpperCase())}${avatar ? `<img src="${esc(avatar)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}</span>` +
            `<div class="cm-body">${amount}${badge}<span class="cm-user" style="color:${esc(color)}">@${esc(user)}:</span>` +
            `<span class="cm-text">${body || (msg.kind === 'member' ? 'vừa trở thành hội viên!' : '')}</span></div>`;
        el.addEventListener('animationend', (e) => {
            if (e.animationName === 'cmIn') el.classList.add('cm-done');
        });
        flip(() => list.appendChild(el));
        trim();
        if (lifetime > 0) setTimeout(() => removeMsg(el), lifetime);
    }

    /** Hiện logo YouTube ở tab chat khi đang nối chat thật. */
    function setSource(src) { root.classList.toggle('yt', src === 'youtube'); }

    function clear() {
        Array.from(list.children).forEach(removeMsg);
    }

    /* ---------- Fake chat ---------- */
    function scheduleFake() {
        clearTimeout(fakeTimer);
        if (!fakeOn) return;
        const [a, b] = cfg.fakeInterval || [1600, 4200];
        fakeTimer = setTimeout(() => {
            add({ user: pick(cfg.fakeUsers || ['fan']), text: pick(cfg.fakeMessages || ['Cố lên!']) });
            scheduleFake();
        }, rand(a, b));
    }

    function setFake(on) {
        on = !!on;
        if (on === fakeOn) return;
        fakeOn = on;
        scheduleFake();
    }

    /* ---------- WebSocket (chat thật) ----------
     * Server gửi: {"user":"abc","text":"hello"}  hoặc  [{...},{...}]   */
    function connect(url) {
        if (!url) return;
        try { ws = new WebSocket(url); } catch (e) { return; }
        ws.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                (Array.isArray(data) ? data : [data]).forEach(add);
            } catch (err) { add({ user: 'chat', text: String(e.data) }); }
        };
        ws.onclose = () => setTimeout(() => connect(url), 3000);
    }

    function init(el, chatCfg) {
        root = el;
        list = el.querySelector('.chat-list');
        cfg = chatCfg || {};
        max = cfg.maxMessages || 5;
        lifetime = cfg.messageLifetime || 0;
        const words = (cfg.bannedWords || []).map((w) => String(w).trim()).filter(Boolean)
            .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        bannedRe = words.length ? new RegExp(words.join('|'), 'gi') : null;
        (cfg.messages || []).forEach(add);
        connect(cfg.websocketUrl);
    }

    function apply(chatState) {
        root.classList.toggle('off', !chatState.visible);
        if (chatState.max && chatState.max !== max) { max = chatState.max; trim(); }
    }

    window.Chat = { init, apply, add, clear, setFake, setSource, isFake: () => fakeOn };
})();
