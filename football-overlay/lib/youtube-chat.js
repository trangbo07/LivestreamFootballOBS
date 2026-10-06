/* =====================================================================
 *  YOUTUBE-CHAT.JS — đọc bình luận live chat YouTube (chạy trong server.js)
 *
 *  2 chế độ:
 *   • Mặc định (không cần key): đọc trực tiếp như trình duyệt mở cửa sổ
 *     live chat (youtubei/v1/live_chat/get_live_chat). Không tốn quota.
 *     Đây là API nội bộ của YouTube — nếu YouTube đổi cấu trúc có thể
 *     cần cập nhật file này.
 *   • Có apiKey: dùng YouTube Data API v3 chính thức (liveChatMessages).
 *     Ổn định nhưng tốn quota (~5 đơn vị / lần đọc, 10.000 / ngày).
 *
 *  Sự kiện:  'message' (msg)   'status' ({ state, ... })
 *  msg = { id, user, avatar, parts:[{text}|{img,alt}], text, badge, amount, kind }
 * ===================================================================== */
const { EventEmitter } = require('events');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const HEADERS = { 'User-Agent': UA, 'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8', 'Cookie': 'CONSENT=YES+1' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const last = (a) => (Array.isArray(a) && a.length ? a[a.length - 1] : null);

async function fetchText(url) {
    const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status} khi tải ${url}`);
    return res.text();
}

/** Lấy object JSON gán cho biến (vd. ytInitialData) trong HTML. */
function extractJson(html, name) {
    const i = html.indexOf(name);
    if (i < 0) return null;
    const start = html.indexOf('{', i);
    if (start < 0) return null;
    let depth = 0, inStr = false, esc = false;
    for (let k = start; k < html.length; k++) {
        const c = html[k];
        if (inStr) {
            if (esc) esc = false;
            else if (c === '\\') esc = true;
            else if (c === '"') inStr = false;
            continue;
        }
        if (c === '"') inStr = true;
        else if (c === '{') depth++;
        else if (c === '}') {
            depth--;
            if (depth === 0) {
                try { return JSON.parse(html.slice(start, k + 1)); } catch (e) { return null; }
            }
        }
    }
    return null;
}

/**
 * Chuyển link / ID / @kênh → video ID đang live.
 * Hỗ trợ: ID 11 ký tự, watch?v=, youtu.be/, /live/ID, /shorts/, /embed/,
 *         @handle, youtube.com/@handle, /channel/UC..., /c/ten
 */
async function resolveVideoId(source) {
    const s = String(source || '').trim();
    if (!s) throw new Error('Chưa nhập link YouTube');
    if (/^[\w-]{11}$/.test(s)) return s;

    let url;
    try { url = new URL(/^https?:\/\//i.test(s) ? s : (s.startsWith('@') ? `https://www.youtube.com/${s}` : `https://${s}`)); }
    catch (e) { throw new Error('Link YouTube không hợp lệ'); }

    const v = url.searchParams.get('v');
    if (v && /^[\w-]{11}$/.test(v)) return v;
    if (/youtu\.be$/i.test(url.hostname)) {
        const id = url.pathname.slice(1, 12);
        if (/^[\w-]{11}$/.test(id)) return id;
    }
    const m = url.pathname.match(/^\/(?:live|shorts|embed|v)\/([\w-]{11})/);
    if (m) return m[1];

    // Link kênh → mở trang /live của kênh để lấy video đang phát
    const ch = url.pathname.match(/^\/(@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)/);
    if (ch) {
        const html = await fetchText(`https://www.youtube.com/${ch[1]}/live`);
        const canon = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/);
        if (canon) return canon[1];
        throw new Error('Kênh này hiện không phát trực tiếp');
    }
    throw new Error('Không nhận ra link YouTube');
}

/* ---------------- Phân tích tin nhắn (chế độ không key) ---------------- */
function runsToParts(runs) {
    return (runs || []).map((r) => {
        if (r.text != null) return { text: r.text };
        if (r.emoji) {
            const e = r.emoji;
            if (e.isCustomEmoji) {
                const t = last(e.image && e.image.thumbnails);
                return t ? { img: t.url, alt: (e.shortcuts && e.shortcuts[0]) || '' } : { text: (e.shortcuts && e.shortcuts[0]) || '' };
            }
            return { text: e.emojiId || (e.shortcuts && e.shortcuts[0]) || '' };
        }
        return null;
    }).filter(Boolean);
}

function badgeOf(badges) {
    let out = '';
    for (const b of badges || []) {
        const r = b.liveChatAuthorBadgeRenderer;
        if (!r) continue;
        const t = r.icon && r.icon.iconType;
        if (t === 'OWNER') return 'owner';
        if (t === 'MODERATOR') out = 'mod';
        else if (r.customThumbnail && !out) out = 'member';
        else if (t === 'VERIFIED' && !out) out = 'verified';
    }
    return out;
}

function parseItem(item) {
    const r = item.liveChatTextMessageRenderer || item.liveChatPaidMessageRenderer ||
        item.liveChatMembershipItemRenderer || item.liveChatPaidStickerRenderer;
    if (!r) return null;
    const parts = runsToParts((r.message && r.message.runs) || (r.headerSubtext && r.headerSubtext.runs));
    const avatar = last(r.authorPhoto && r.authorPhoto.thumbnails);
    return {
        id: r.id,
        user: (r.authorName && r.authorName.simpleText) || 'YouTube',
        avatar: avatar ? avatar.url.replace(/^\/\//, 'https://') : '',
        parts,
        text: parts.map((p) => p.text || p.alt || '').join(''),
        badge: badgeOf(r.authorBadges),
        amount: (r.purchaseAmountText && r.purchaseAmountText.simpleText) || '',
        kind: item.liveChatMembershipItemRenderer ? 'member' : (item.liveChatPaidStickerRenderer ? 'sticker' : '')
    };
}

class YouTubeChat extends EventEmitter {
    constructor() {
        super();
        this.session = 0;
        this.status = { state: 'idle' };
        this.seen = new Set();
    }

    setStatus(s) {
        this.status = Object.assign({ at: Date.now() }, s);
        this.emit('status', this.status);
    }

    stop(reason) {
        this.session++;
        if (this.status.state !== 'idle') this.setStatus({ state: 'idle', message: reason || 'Đã ngắt kết nối' });
    }

    /** opts: { apiKey, maxPerPoll } */
    async start(source, opts) {
        opts = opts || {};
        const session = ++this.session;
        this.seen.clear();
        this.count = 0;
        this.setStatus({ state: 'connecting', source, message: 'Đang tìm live chat…' });
        try {
            const videoId = await resolveVideoId(source);
            if (session !== this.session) return;
            const title = await this.fetchTitle(videoId);
            if (opts.apiKey) await this.runApi(session, videoId, title, opts);
            else await this.runInnertube(session, videoId, title, opts);
        } catch (e) {
            if (session === this.session) this.setStatus({ state: 'error', source, message: e.message || String(e) });
        }
    }

    async fetchTitle(videoId) {
        try {
            const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, { headers: HEADERS });
            if (r.ok) return (await r.json()).title || '';
        } catch (e) { /* ignore */ }
        return '';
    }

    emitMessages(list, max) {
        let n = 0;
        for (const m of list) {
            if (!m || (m.id && this.seen.has(m.id))) continue;
            if (m.id) {
                this.seen.add(m.id);
                if (this.seen.size > 3000) this.seen = new Set(Array.from(this.seen).slice(-1500));
            }
            if (n++ >= max) continue;          // chat quá đông → bỏ bớt, tránh tràn khung
            this.count++;
            this.emit('message', m);
        }
    }

    /* -------- Chế độ không cần key -------- */
    async runInnertube(session, videoId, title, opts) {
        const html = await fetchText(`https://www.youtube.com/live_chat?is_popout=1&v=${videoId}`);
        const key = (html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || [])[1];
        const version = (html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/) || html.match(/"clientVersion":"([\d.]+)"/) || [])[1] || '2.20240101.00.00';
        const data = extractJson(html, 'ytInitialData');
        const lcr = data && data.contents && data.contents.liveChatRenderer;
        if (!lcr) throw new Error('Video này không có live chat (chưa live, đã kết thúc hoặc tắt chat)');
        const firstCont = lcr.continuations && lcr.continuations[0];
        const cd = firstCont && (firstCont.invalidationContinuationData || firstCont.timedContinuationData || firstCont.reloadContinuationData);
        if (!cd) throw new Error('Không đọc được live chat');
        let continuation = cd.continuation;
        // Bỏ qua tin cũ có sẵn khi mới mở, chỉ hiện tin mới
        for (const a of lcr.actions || []) {
            const it = a.addChatItemAction && a.addChatItemAction.item;
            const m = it && parseItem(it);
            if (m && m.id) this.seen.add(m.id);
        }

        this.setStatus({ state: 'live', mode: 'Không cần key', videoId, title, message: 'Đang nhận bình luận' });
        let errors = 0;
        while (session === this.session) {
            let timeout = 2000;
            try {
                const res = await fetch(`https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?prettyPrint=false${key ? '&key=' + key : ''}`, {
                    method: 'POST',
                    headers: Object.assign({ 'Content-Type': 'application/json' }, HEADERS),
                    body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion: version, hl: 'vi', gl: 'VN' } }, continuation })
                });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const j = await res.json();
                const lcc = j.continuationContents && j.continuationContents.liveChatContinuation;
                if (!lcc) {
                    this.setStatus({ state: 'error', videoId, title, message: 'Live chat đã kết thúc' });
                    return;
                }
                const msgs = (lcc.actions || []).map((a) => {
                    const it = a.addChatItemAction && a.addChatItemAction.item;
                    return it ? parseItem(it) : null;
                });
                if (session !== this.session) return;
                this.emitMessages(msgs, opts.maxPerPoll || 25);
                const c = lcc.continuations && lcc.continuations[0];
                const next = c && (c.invalidationContinuationData || c.timedContinuationData || c.reloadContinuationData);
                if (!next) {
                    this.setStatus({ state: 'error', videoId, title, message: 'Live chat đã kết thúc' });
                    return;
                }
                continuation = next.continuation;
                timeout = Math.min(6000, Math.max(1000, next.timeoutMs || 2000));
                errors = 0;
                this.status.count = this.count;
            } catch (e) {
                errors++;
                if (errors >= 8) {
                    this.setStatus({ state: 'error', videoId, title, message: 'Mất kết nối YouTube: ' + e.message });
                    return;
                }
                timeout = 2000 * errors;
            }
            await sleep(timeout);
        }
    }

    /* -------- Chế độ YouTube Data API v3 -------- */
    async runApi(session, videoId, title, opts) {
        const K = encodeURIComponent(opts.apiKey);
        const vr = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,snippet&id=${videoId}&key=${K}`);
        const vj = await vr.json();
        if (vj.error) throw new Error('API: ' + vj.error.message);
        const item = vj.items && vj.items[0];
        const chatId = item && item.liveStreamingDetails && item.liveStreamingDetails.activeLiveChatId;
        if (!chatId) throw new Error('Video không có live chat đang hoạt động');
        title = title || (item.snippet && item.snippet.title) || '';

        this.setStatus({ state: 'live', mode: 'YouTube Data API', videoId, title, message: 'Đang nhận bình luận' });
        let pageToken = '';
        let first = true;
        while (session === this.session) {
            let wait = 5000;
            try {
                const r = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${encodeURIComponent(chatId)}&part=snippet,authorDetails&maxResults=200&key=${K}${pageToken ? '&pageToken=' + pageToken : ''}`);
                const j = await r.json();
                if (j.error) {
                    this.setStatus({ state: 'error', videoId, title, message: 'API: ' + j.error.message });
                    return;
                }
                pageToken = j.nextPageToken || pageToken;
                wait = Math.max(j.pollingIntervalMillis || 5000, 4000);    // tiết kiệm quota
                if (!first) {
                    const msgs = (j.items || []).map((it) => {
                        const sn = it.snippet || {}, au = it.authorDetails || {};
                        const sc = sn.superChatDetails;
                        const text = (sc && sc.userComment) || sn.displayMessage || '';
                        return {
                            id: it.id,
                            user: au.displayName || 'YouTube',
                            avatar: au.profileImageUrl || '',
                            parts: [{ text }],
                            text,
                            badge: au.isChatOwner ? 'owner' : au.isChatModerator ? 'mod' : au.isChatSponsor ? 'member' : au.isVerified ? 'verified' : '',
                            amount: (sc && sc.amountDisplayString) || (sn.superStickerDetails && sn.superStickerDetails.amountDisplayString) || '',
                            kind: sn.type === 'newSponsorEvent' ? 'member' : ''
                        };
                    });
                    this.emitMessages(msgs, opts.maxPerPoll || 25);
                    this.status.count = this.count;
                }
                first = false;
            } catch (e) {
                wait = 8000;
            }
            await sleep(wait);
        }
    }
}

module.exports = { YouTubeChat, resolveVideoId, extractJson, parseItem };
