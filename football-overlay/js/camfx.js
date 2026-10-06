/* =====================================================================
 *  CAMFX.JS — khung & nhãn cho bố cục 2 camera (PiP / chia đôi).
 *  Camera thật do OBS hiển thị (server điều khiển qua obs-websocket);
 *  overlay chỉ vẽ viền, nhãn và nền tối quanh khung cho khớp.
 *  Vị trí khung: CONFIG.cameras.rects (phải trùng với server.js).
 * ===================================================================== */
(function () {
    'use strict';
    const { esc } = window.Util;

    let root, rects, labels, photoTitle, current = null, photoKey = '', lastPhoto = null;

    /** Đường viền chữ nhật bo góc cho SVG (dùng làm "lỗ" trong nền tối). */
    function roundRect(r, rad) {
        const { x, y, w, h } = r;
        return `M${x + rad} ${y}H${x + w - rad}A${rad} ${rad} 0 0 1 ${x + w} ${y + rad}V${y + h - rad}A${rad} ${rad} 0 0 1 ${x + w - rad} ${y + h}` +
            `H${x + rad}A${rad} ${rad} 0 0 1 ${x} ${y + h - rad}V${y + rad}A${rad} ${rad} 0 0 1 ${x + rad} ${y}Z`;
    }

    function frame(r, label, cls) {
        return `<div class="camfx-frame ${cls || ''}" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px">
            <span class="camfx-label"><i></i>${esc(label)}</span></div>`;
    }

    /** Nửa phải của bố cục "cam + ảnh": ảnh trận đấu có tiêu đề, phút, chú thích. */
    function photoInner(p) {
        if (!p || !p.src) return `<div class="camfx-ph-empty">${esc(window.I18N.L('Chưa có ảnh — đăng ảnh ở mục 📸 Khung ảnh trận đấu'))}</div>`;
        return `<div class="camfx-ph-slide">
                <div class="camfx-ph-bg" style="background-image:url('${esc(p.src)}')"></div>
                <img class="camfx-ph-img" src="${esc(p.src)}" alt="">
            </div><div class="camfx-ph-flash"></div>
            <div class="camfx-ph-head"><span class="camfx-ph-dot"></span>${esc(photoTitle)}${p.minute ? `<b>${esc(p.minute)}</b>` : ''}</div>
            ${p.caption || p.pos ? `<div class="camfx-ph-cap"><span>${esc(window.I18N.L(p.caption || ''))}</span>${p.pos ? `<small>${esc(p.pos)}</small>` : ''}</div>` : ''}`;
    }

    function photoPanel(p) {
        const r = rects.right;
        return `<div class="camfx-photo" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px">${photoInner(p)}</div>`;
    }

    function build(layout, photo) {
        if (layout === 'photo' || layout === 'photo2') {
            return `<svg class="camfx-bd" viewBox="0 0 1920 1080" preserveAspectRatio="none">
                    <path fill-rule="evenodd" d="M0 0H1920V1080H0Z ${roundRect(rects.left, 16)}"/></svg>` +
                frame(rects.left, layout === 'photo' ? labels.close : labels.wide, 'left') + photoPanel(photo);
        }
        if (layout === 'pip') return frame(rects.pip, labels.close, 'small');
        if (layout === 'pip2') return frame(rects.pip, labels.wide, 'small');
        if (layout === 'split') {
            return `<svg class="camfx-bd" viewBox="0 0 1920 1080" preserveAspectRatio="none">
                    <path fill-rule="evenodd" d="M0 0H1920V1080H0Z ${roundRect(rects.left, 16)} ${roundRect(rects.right, 16)}"/></svg>` +
                frame(rects.left, labels.close, 'left') + frame(rects.right, labels.wide, 'right');
        }
        return '';
    }

    function init(el, cfg) {
        root = el;
        cfg = cfg || {};
        const R = cfg.rects || {};
        rects = {
            pip: R.pip || { x: 1452, y: 64, w: 408, h: 230 },
            left: R.left || { x: 40, y: 150, w: 912, h: 513 },
            right: R.right || { x: 968, y: 150, w: 912, h: 513 }
        };
        labels = Object.assign({ close: 'CAM CẬN', wide: 'TOÀN CẢNH' }, cfg.labels || {});
        photoTitle = cfg.photoTitle || 'KHOẢNH KHẮC TRẬN ĐẤU';
    }

    /** layout: close | wide | pip | pip2 | split | photo | photo2 ; hidden = đang ở chế độ phân tích
     *  photo: { src, caption, minute, pos } — ảnh cho bố cục cam + ảnh */
    function apply(layout, hidden, photo) {
        const want = hidden ? 'none' : layout;
        lastPhoto = photo || null;
        const key = photo ? [photo.src, photo.caption, photo.minute, photo.pos].join('|') : '';
        if (want === current) {
            // Cùng bố cục, chỉ đổi ảnh → thay ảnh tại chỗ (có đèn flash), không dựng lại khung
            if ((want === 'photo' || want === 'photo2') && key !== photoKey) {
                photoKey = key;
                const panel = root.querySelector('.camfx-photo');
                if (panel) panel.innerHTML = photoInner(photo);
            }
            return;
        }
        current = want;
        photoKey = key;
        root.classList.remove('on');
        clearTimeout(apply._t);
        // Đợi camera trong OBS trượt xong rồi mới hiện viền cho khớp
        apply._t = setTimeout(() => {
            root.innerHTML = build(want, lastPhoto);
            void root.offsetWidth;
            root.classList.toggle('on', !!root.innerHTML);
        }, current === 'none' ? 0 : 450);
    }

    window.CamFx = { init, apply };
})();
