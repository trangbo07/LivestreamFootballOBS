/* =====================================================================
 *  AI-ASSISTANT.JS — trợ lý AI trả lời bình luận YouTube (OpenAI)
 *
 *  Mỗi bình luận YouTube → 1 lần gọi OpenAI, trả về:
 *    vi        — bình luận dịch sang tiếng Việt
 *    kind      — "question" | "comment"
 *    answer_en — câu trả lời gợi ý bằng tiếng Anh, từ ngữ đơn giản
 *    answer_vi — nghĩa tiếng Việt của câu trả lời
 *  Kết quả phát ra sự kiện 'reply' → server đẩy lên trang assistant.html.
 *  Chỉ người dẫn thấy (không lên overlay), người dẫn đọc rồi tự trả lời.
 * ===================================================================== */
'use strict';
const { EventEmitter } = require('events');

const API_URL = 'https://api.openai.com/v1/chat/completions';
const MAX_QUEUE = 40;          // chat nhanh quá → bỏ bớt tin cũ nhất đang chờ
const CONCURRENCY = 2;
const HISTORY = 60;

const SYSTEM = (ctx) => `You help the host of the Vietnamese YouTube football channel "${ctx.channel}" answer live chat in English.
${ctx.match ? 'Live match right now: ' + ctx.match + '.' : ''}
For each viewer comment, return JSON only:
{"vi": "...", "kind": "question" | "comment", "answer_en": "...", "answer_vi": "..."}
- vi: the comment translated into natural Vietnamese (if it is already Vietnamese, copy it and fix obvious typos).
- kind: "question" if the viewer asks something, else "comment".
- answer_en: what the host can SAY out loud. Use VERY SIMPLE English (A1-A2 level): short common words, short sentences, max 20 words, friendly. No hard words, no slang, no emojis.
- answer_vi: the Vietnamese meaning of answer_en.
If you do not know a fact (live score, lineups, transfer news), give a safe simple answer and do not invent numbers. Never be rude, even to rude comments.`;

class AIAssistant extends EventEmitter {
    constructor() {
        super();
        this.settings = { apiKey: '', model: 'gpt-4o-mini', enabled: false, onlyQuestions: false };
        this.queue = [];
        this.active = 0;
        this.history = [];
        this.context = () => ({});
        this.status = { state: 'off', message: 'Chưa bật' };
        this.count = 0;
    }

    configure(patch) {
        Object.assign(this.settings, patch || {});
        if (!this.settings.apiKey) this.setStatus('off', 'Chưa nhập OpenAI API key');
        else this.setStatus(this.settings.enabled ? 'on' : 'off', this.settings.enabled ? 'Đang trả lời bình luận' : 'Đã tắt');
        if (!this.settings.enabled) this.queue = [];
    }

    setStatus(state, message) {
        this.status = { state, message };
        this.emit('status', this.publicStatus());
    }

    publicStatus() {
        const s = this.settings;
        return Object.assign({}, this.status, {
            hasKey: !!s.apiKey, keyHint: s.apiKey ? '…' + s.apiKey.slice(-4) : '',
            model: s.model, enabled: !!s.enabled, onlyQuestions: !!s.onlyQuestions,
            waiting: this.queue.length, count: this.count
        });
    }

    /** Bình luận mới từ YouTube (hoặc nhập tay để thử). */
    push(m, force) {
        if (!force && !(this.settings.enabled && this.settings.apiKey)) return;
        const text = String((m && m.text) || '').trim();
        // Bỏ tin rỗng / chỉ có emoji, ký hiệu
        if (!text || !/[\p{L}\p{N}]/u.test(text)) return;
        const item = {
            id: 'ai-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            user: (m && m.user) || '', avatar: (m && m.avatar) || '', text,
            amount: (m && m.amount) || '', at: Date.now(), state: 'pending'
        };
        this.queue.push(item);
        while (this.queue.length > MAX_QUEUE) this.queue.shift();
        this.pump();
    }

    pump() {
        while (this.active < CONCURRENCY && this.queue.length) {
            // Super Chat được ưu tiên
            const i = Math.max(0, this.queue.findIndex((x) => x.amount));
            const item = this.queue.splice(i, 1)[0];
            this.active++;
            this.handle(item).finally(() => { this.active--; this.pump(); });
        }
    }

    async handle(item) {
        try {
            const r = await this.ask(item);
            if (this.settings.onlyQuestions && r.kind !== 'question' && !item.amount) return;
            Object.assign(item, r, { state: 'done' });
            this.count++;
            this.history.push(item);
            while (this.history.length > HISTORY) this.history.shift();
            this.emit('reply', item);
            if (this.status.state === 'error') this.setStatus('on', 'Đang trả lời bình luận');
        } catch (e) {
            this.setStatus('error', e.message);
        }
    }

    async ask(item) {
        const ctx = this.context() || {};
        const r = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.settings.apiKey },
            body: JSON.stringify({
                model: this.settings.model || 'gpt-4o-mini',
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: SYSTEM(ctx) },
                    { role: 'user', content: `Viewer "${item.user}" wrote: ${item.text}` }
                ]
            }),
            signal: AbortSignal.timeout(30000)
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
            const msg = (j.error && j.error.message) || ('HTTP ' + r.status);
            throw new Error(r.status === 401 ? 'API key OpenAI sai hoặc đã bị thu hồi' : 'OpenAI: ' + msg);
        }
        let out = {};
        try { out = JSON.parse(j.choices[0].message.content); } catch (e) { throw new Error('OpenAI trả về dữ liệu không đọc được'); }
        return {
            vi: String(out.vi || ''), kind: out.kind === 'question' ? 'question' : 'comment',
            answer_en: String(out.answer_en || ''), answer_vi: String(out.answer_vi || '')
        };
    }
}

module.exports = { AIAssistant };
