/* =====================================================================
 *  I18N.JS — bản tiếng Anh cho overlay.
 *
 *  Mở overlay với  index.html?lang=en  → chữ hiển thị chuyển sang tiếng Anh.
 *  Overlay tiếng Việt và tiếng Anh dùng chung control panel / tỷ số /
 *  đồng hồ; chỉ phần chữ hiển thị khác nhau.
 *
 *  Nguồn bản dịch:
 *   1. UI — từ điển cố định bên dưới (nhãn, tiêu đề…)
 *   2. Nội dung — CONFIG.english (cùng cấu trúc với CONFIG): mỗi chuỗi
 *      trong CONFIG.english là bản dịch của chuỗi cùng vị trí trong CONFIG.
 *   Chuỗi không có bản dịch (vd. tên cầu thủ, chú thích tự gõ) giữ nguyên.
 * ===================================================================== */
(function () {
    'use strict';

    const params = new URLSearchParams(location.search);
    const lang = (params.get('lang') || (window.CONFIG && window.CONFIG.language) || 'vi').toLowerCase() === 'en' ? 'en' : 'vi';

    const UI = {
        // Thống kê
        'KIỂM SOÁT BÓNG': 'POSSESSION', 'SỐ CÚ SÚT': 'SHOTS', 'SÚT TRÚNG ĐÍCH': 'SHOTS ON TARGET',
        'PHẠT GÓC': 'CORNERS', 'PHẠM LỖI': 'FOULS', 'VIỆT VỊ': 'OFFSIDES', 'THẺ VÀNG': 'YELLOW CARDS',
        'THẺ ĐỎ': 'RED CARDS', 'CỨU THUA': 'SAVES', 'BÓNG: ': 'BALL: ',
        'THỐNG KÊ TRẬN ĐẤU': 'MATCH STATS', 'THỐNG KÊ': 'STATS',
        // Phân tích
        'SA BÀN TRỰC TIẾP': 'LIVE MATCH TRACKER', 'DIỄN BIẾN': 'MATCH EVENTS', 'Chưa có tình huống nào': 'No events yet', 'Kiến tạo': 'Assist', 'PHẠT ĐỀN': 'PENALTY', 'PHẢN LƯỚI NHÀ': 'OWN GOAL', 'THAY NGƯỜI': 'SUBSTITUTION', 'HỎNG PHẠT ĐỀN': 'PENALTY MISSED', 'ÍT': 'LOW', 'NHIỀU': 'HIGH', 'CẢ HAI ĐỘI': 'BOTH TEAMS', 'ĐỘI NHÀ': 'HOME',
        '◀ HƯỚNG TẤN CÔNG': '◀ ATTACKING', 'HƯỚNG TẤN CÔNG ▶': 'ATTACKING ▶',
        // Đội hình
        'ĐỘI HÌNH RA SÂN': 'LINE-UPS', 'ĐÁ CHÍNH': 'STARTING', 'DỰ BỊ': 'SUBSTITUTES', 'DỰ BỊ: ': 'SUBS: ', 'HLV': 'COACH',
        // Đếm ngược / ủng hộ
        'TRẬN ĐẤU SẮP BẮT ĐẦU': 'KICK-OFF IS COMING UP', 'TRẬN ĐẤU BẮT ĐẦU!': 'KICK-OFF!',
        'ĐĂNG KÝ KÊNH & BẬT CHUÔNG ĐỂ KHÔNG BỎ LỠ': 'SUBSCRIBE & TURN ON NOTIFICATIONS',
        'ỦNG HỘ CHÚNG TÔI': 'SUPPORT US', 'NGÂN HÀNG': 'BANK', 'CHỦ TK': 'ACCOUNT', 'NỘI DUNG': 'REFERENCE',
        // Chat
        'CHỦ KÊNH': 'OWNER', 'HỘI VIÊN': 'MEMBER', 'vừa trở thành hội viên!': 'just became a member!',
        // Camera / ảnh
        'CAM CẬN': 'CLOSE-UP', 'TOÀN CẢNH': 'WIDE', 'KHOẢNH KHẮC TRẬN ĐẤU': 'MATCH MOMENTS',
        'Chưa có ảnh — đăng ảnh ở mục 📸 Khung ảnh trận đấu': 'No photo yet',
        // Tri ân
        'GIAO HỮU QUỐC TẾ': 'INTERNATIONAL FRIENDLY', 'ĐÊM TRI ÂN': 'TRIBUTE NIGHT', 'HUYỀN THOẠI SỐ 10': 'THE NUMBER 10 LEGEND',
        'CẢM ƠN, LEO!': 'THANK YOU, LEO!', 'TRỰC TIẾP TRÊN': 'LIVE ON', 'VÀO SÂN:': 'ON:', 'BXH FIFA': 'FIFA RANKING',
        'HUYỀN THOẠI SỐ 7': 'THE NUMBER 7 LEGEND', 'CẢM ƠN, CR7!': 'THANK YOU, CR7!', 'ĐÊM CỦA CR7': 'CR7 NIGHT'
    };
    const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

    /* Ghép cặp CONFIG ↔ CONFIG.english theo cùng vị trí → bảng dịch nội dung */
    const map = Object.assign({}, UI);
    function pair(base, en) {
        if (base == null || en == null) return;
        if (typeof base === 'string' && typeof en === 'string') { if (base.trim()) map[base.trim()] = en; return; }
        if (typeof base === 'string' && typeof en === 'object' && en.text) { map[base.replace(/^[^|]{1,12}\|/, '').trim()] = en.text; return; }
        if (typeof base === 'object' && typeof en === 'string') { if (base.text) map[String(base.text).trim()] = en; return; }
        if (typeof base === 'object' && typeof en === 'object') Object.keys(en).forEach((k) => pair(base[k], en[k]));
    }
    if (lang === 'en' && window.CONFIG && window.CONFIG.english) {
        const { english, ...base } = window.CONFIG;
        pair(base, english);
    }

    /** Dịch 1 chuỗi hiển thị (tiếng Việt → tiếng Anh nếu đang ở bản tiếng Anh). */
    function L(s) {
        if (lang !== 'en' || s == null || s === '') return s;
        const str = String(s);
        const key = str.trim();
        if (map[key] != null) return map[key];
        if (/^ĐT\s+/i.test(key)) return L(key.replace(/^ĐT\s+/i, ''));    // "ĐT ARGENTINA" → "ARGENTINA"
        return str;
    }

    /** Dịch mọi chuỗi trong 1 object (bản sao) — dùng cho cấu hình của từng module. */
    function deep(o) {
        if (lang !== 'en' || o == null) return o;
        if (typeof o === 'string') return L(o);
        if (Array.isArray(o)) return o.map(deep);
        if (typeof o === 'object') { const r = {}; Object.keys(o).forEach((k) => { r[k] = deep(o[k]); }); return r; }
        return o;
    }

    /** Đội: dịch tên hiển thị, giữ logo / màu. */
    const team = (t) => (lang !== 'en' || !t) ? t : Object.assign({}, t, { name: L(t.name), short: L(t.short) });

    window.I18N = {
        lang, L, deep, team,
        month: (m) => lang === 'en' ? MONTHS[(m - 1 + 12) % 12] : 'THÁNG ' + m
    };
    document.documentElement.lang = lang;
})();
