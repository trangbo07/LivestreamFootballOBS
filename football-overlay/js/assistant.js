/* =====================================================================
 *  ASSISTANT.JS — màn hình trợ lý AI (assistant.html)
 *  Nghe server qua SSE (/events): "ai-reply" = 1 bình luận đã có gợi ý trả lời,
 *  "ai-status" = trạng thái trợ lý. Cài đặt gửi lên /api/ai/config.
 * ===================================================================== */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const MAX_CARDS = 80;

    /* ---------- Lưu tiện ích trên máy này (cỡ chữ, thẻ đã xong / ghim) ---------- */
    const store = {
        get(k, d) { try { const v = localStorage.getItem('ai-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
        set(k, v) { try { localStorage.setItem('ai-' + k, JSON.stringify(v)); } catch (e) { /* bỏ qua */ } }
    };
    const marks = store.get('marks', {});      // id → 'done' | 'pinned'
    const saveMarks = () => {
        const keys = Object.keys(marks);
        if (keys.length > 300) keys.slice(0, keys.length - 300).forEach((k) => delete marks[k]);
        store.set('marks', marks);
    };

    /* ---------- Gọi API server ---------- */
    async function api(path, body) {
        const r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.ok === false) throw new Error(j.error || ('HTTP ' + r.status));
        return j;
    }

    /* ---------- Trạng thái ---------- */
    let status = {};
    function renderStatus(s) {
        status = s || {};
        const st = $('st');
        st.className = 'pill ' + (status.state === 'error' ? 'error' : status.enabled && status.hasKey ? 'on' : '');
        st.textContent = !status.hasKey ? 'Chưa có API key'
            : status.state === 'error' ? '⚠ ' + status.message
            : status.enabled ? `Đang bật · ${status.model} · ${status.count || 0} câu` : 'Đang tắt';
        st.title = status.message || '';
        $('btn-on').textContent = status.enabled ? 'BẬT' : 'TẮT';
        $('btn-on').classList.toggle('on', !!status.enabled);
        $('btn-q').classList.toggle('on', !!status.onlyQuestions);
        if (document.activeElement !== $('model')) $('model').value = status.model || '';
        $('key').placeholder = status.hasKey ? `Đã lưu key ${status.keyHint} — dán key mới để thay` : 'sk-... (dán vào đây)';
        if (!status.hasKey) $('settings').hidden = false;
    }

    /* ---------- Thẻ bình luận ---------- */
    const timeOf = (t) => new Date(t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    function card(it) {
        const el = document.createElement('article');
        el.className = `card ${it.kind === 'question' ? 'question' : 'comment'}${it.amount ? ' money' : ''}`;
        el.dataset.id = it.id;
        const av = it.avatar
            ? `<img src="${esc(it.avatar)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">`
            : `<span class="c-av">${esc(((it.user || '?').replace(/^@/, '')[0] || '?').toUpperCase())}</span>`;
        const same = it.vi && it.vi.trim().toLowerCase() === it.text.trim().toLowerCase();
        el.innerHTML = `
            <div class="c-head">${av}<span class="c-user">${esc(it.user)}</span>
                <span class="c-tag">${it.kind === 'question' ? '❓ Câu hỏi' : '💬 Bình luận'}</span>
                ${it.amount ? `<span class="c-money">${esc(it.amount)}</span>` : ''}
                <span class="c-time">${timeOf(it.at)}</span></div>
            ${same ? '' : `<div class="c-orig">“${esc(it.text)}”</div>`}
            <div class="c-vi"><b>DỊCH</b>${esc(it.vi || it.text)}</div>
            <div class="c-ans">${esc(it.answer_en)}</div>
            <div class="c-mean"><b>NGHĨA</b>${esc(it.answer_vi)}</div>
            <div class="c-actions">
                <button data-act="say" title="Nghe cách đọc">🔊 Nghe</button>
                <button data-act="pin" title="Ghim lên đầu">📌 Ghim</button>
                <button data-act="done" title="Đã trả lời">✓ Xong</button>
            </div>`;
        el._item = it;
        applyMark(el);
        return el;
    }

    function applyMark(el) {
        const m = marks[el.dataset.id];
        el.classList.toggle('done', m === 'done');
        el.classList.toggle('pinned', m === 'pinned');
        const pin = el.querySelector('[data-act="pin"]');
        if (pin) pin.textContent = m === 'pinned' ? '📌 Bỏ ghim' : '📌 Ghim';
    }

    /** Thẻ ghim nằm trên cùng, rồi tới thẻ mới nhất. */
    function place(el) {
        const feed = $('feed');
        if (marks[el.dataset.id] === 'pinned') return feed.prepend(el);
        const firstUnpinned = Array.from(feed.querySelectorAll('.card')).find((c) => marks[c.dataset.id] !== 'pinned' && c !== el);
        if (firstUnpinned) feed.insertBefore(el, firstUnpinned); else feed.appendChild(el);
    }

    function add(it) {
        if (!it || !it.id || document.querySelector(`.card[data-id="${CSS.escape(it.id)}"]`)) return;
        $('empty').hidden = true;
        place(card(it));
        const cards = $('feed').querySelectorAll('.card');
        for (let i = cards.length - 1; i >= MAX_CARDS; i--) if (marks[cards[i].dataset.id] !== 'pinned') cards[i].remove();
    }

    function say(text) {
        if (!('speechSynthesis' in window)) return;
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US';
        u.rate = 0.9;
        const v = speechSynthesis.getVoices().find((x) => /^en[-_]US/i.test(x.lang));
        if (v) u.voice = v;
        speechSynthesis.speak(u);
    }

    $('feed').addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const el = b.closest('.card');
        const id = el.dataset.id;
        if (b.dataset.act === 'say') return say(el._item.answer_en);
        if (b.dataset.act === 'done') marks[id] = marks[id] === 'done' ? undefined : 'done';
        if (b.dataset.act === 'pin') marks[id] = marks[id] === 'pinned' ? undefined : 'pinned';
        if (!marks[id]) delete marks[id];
        saveMarks();
        applyMark(el);
        if (b.dataset.act === 'pin') place(el);
    });

    /* ---------- Thanh điều khiển ---------- */
    const toast = (msg) => { $('st').className = 'pill error'; $('st').textContent = '⚠ ' + msg; };
    const setCfg = (body) => api('/api/ai/config', body).then(renderStatus).catch((e) => toast(e.message));

    $('btn-on').onclick = () => {
        if (!status.hasKey) { $('settings').hidden = false; $('key').focus(); return; }
        setCfg({ enabled: !status.enabled });
    };
    $('btn-q').onclick = () => setCfg({ onlyQuestions: !status.onlyQuestions });
    $('btn-set').onclick = () => { $('settings').hidden = !$('settings').hidden; };
    $('btn-save').onclick = async () => {
        const key = $('key').value.trim();
        if (!key && !status.hasKey) return $('key').focus();
        await setCfg({ apiKey: key, model: $('model').value.trim(), enabled: true });
        $('key').value = '';
        if (status.hasKey) $('settings').hidden = true;
    };
    $('key').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-save').click(); });
    $('btn-clear').onclick = () => { if (confirm('Xoá OpenAI API key đã lưu trên máy này?')) setCfg({ clearKey: true, enabled: false }); };

    const sendTest = () => {
        const text = $('test').value.trim();
        if (!text) return;
        api('/api/ai/ask', { user: 'Thử', text }).then(() => { $('test').value = ''; }).catch((e) => toast(e.message));
    };
    $('btn-test').onclick = sendTest;
    $('test').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendTest(); });

    let filter = store.get('filter', 'all');
    function setFilter(f) {
        filter = f;
        store.set('filter', f);
        $('feed').classList.toggle('only-q', f === 'question');
        document.querySelectorAll('#filter button').forEach((b) => b.classList.toggle('on', b.dataset.f === f));
    }
    $('filter').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) setFilter(b.dataset.f); });
    setFilter(filter);

    let fs = store.get('fs', 1);
    const setFs = (v) => { fs = Math.min(2, Math.max(0.7, Math.round(v * 10) / 10)); store.set('fs', fs); document.documentElement.style.setProperty('--fs', fs); };
    $('font-up').onclick = () => setFs(fs + 0.1);
    $('font-dn').onclick = () => setFs(fs - 0.1);
    setFs(fs);

    /* ---------- Kết nối server ---------- */
    api('/api/ai/status').then(renderStatus).catch(() => toast('Không kết nối được server — hãy chạy node server.js'));
    api('/api/ai/history').then((j) => (j.list || []).forEach(add)).catch(() => {});
    const es = new EventSource('/events');
    es.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch (err) { return; }
        if (m.type === 'ai-reply') add(m.payload);
        else if (m.type === 'ai-status') renderStatus(m.payload);
    };
    es.onerror = () => { $('st').className = 'pill error'; $('st').textContent = 'Mất kết nối server…'; };
    es.onopen = () => api('/api/ai/status').then(renderStatus).catch(() => {});
})();
