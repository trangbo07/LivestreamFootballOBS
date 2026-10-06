/* =====================================================================
 *  CAMFX.JS — khung & nhãn cho bố cục 2 camera (PiP / chia đôi).
 *  Camera thật do OBS hiển thị (server điều khiển qua obs-websocket);
 *  overlay chỉ vẽ viền, nhãn và nền tối quanh khung cho khớp.
 *  Vị trí khung: CONFIG.cameras.rects (phải trùng với server.js).
 * ===================================================================== */
(function () {
    'use strict';
    const { esc } = window.Util;

    let root, rects, labels, current = null;

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

    function build(layout) {
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
    }

    /** layout: close | wide | pip | pip2 | split ; hidden = đang ở chế độ phân tích */
    function apply(layout, hidden) {
        const want = hidden ? 'none' : layout;
        if (want === current) return;
        current = want;
        root.classList.remove('on');
        clearTimeout(apply._t);
        // Đợi camera trong OBS trượt xong rồi mới hiện viền cho khớp
        apply._t = setTimeout(() => {
            root.innerHTML = build(want);
            void root.offsetWidth;
            root.classList.toggle('on', !!root.innerHTML);
        }, current === 'none' ? 0 : 450);
    }

    window.CamFx = { init, apply };
})();
