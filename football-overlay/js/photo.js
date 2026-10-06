/* =====================================================================
 *  PHOTO.JS — khung "KHOẢNH KHẮC TRẬN ĐẤU": hiện ảnh chụp trong trận
 *  (phía trên khung chat). Ảnh mới có hiệu ứng đèn flash + chuyển mờ.
 *  Ảnh dọc / lệch tỷ lệ: nền mờ phía sau + ảnh đầy đủ ở giữa.
 * ===================================================================== */
(function () {
    'use strict';
    const { esc } = window.Util;

    let root, cfg = {}, hideTimer = null, current = null;

    function frameHTML() {
        return `<div class="ph-card">
            <div class="ph-head"><span class="ph-dot"></span><span class="ph-title">${esc(cfg.title || 'KHOẢNH KHẮC TRẬN ĐẤU')}</span><span class="ph-min"></span></div>
            <div class="ph-frame"></div>
            <div class="ph-foot"><span class="ph-cap"></span><span class="ph-count"></span></div>
            <i class="ph-corner tl"></i><i class="ph-corner br"></i>
        </div>`;
    }

    function slideHTML(src) {
        return `<div class="ph-slide">
            <div class="ph-bgimg" style="background-image:url('${esc(src)}')"></div>
            <img class="ph-img" src="${esc(src)}" alt="">
        </div><div class="ph-flash"></div>`;
    }

    /** item = { src, caption, minute }; pos = "3/7" (tuỳ chọn) */
    function show(item, pos, duration) {
        if (!item || !item.src) return;
        clearTimeout(hideTimer);
        if (!root.firstElementChild) root.innerHTML = frameHTML();
        const frame = root.querySelector('.ph-frame');
        const same = current && current.src === item.src;
        if (!same) {
            // ảnh cũ mờ dần, ảnh mới nằm trên + đèn flash
            frame.querySelectorAll('.ph-flash').forEach((el) => el.remove());
            frame.querySelectorAll('.ph-slide').forEach((el) => {
                el.classList.add('leaving');
                setTimeout(() => el.remove(), 900);
            });
            frame.insertAdjacentHTML('beforeend', slideHTML(item.src));
        }
        current = item;
        root.querySelector('.ph-min').textContent = item.minute || '';
        root.querySelector('.ph-min').style.display = item.minute ? '' : 'none';
        root.querySelector('.ph-cap').textContent = window.I18N.L(item.caption) || cfg.defaultCaption || '';
        root.querySelector('.ph-count').textContent = pos || '';
        root.classList.add('on');
        const ms = duration != null ? duration : (cfg.duration || 0);
        if (ms > 0) hideTimer = setTimeout(hide, ms);
    }

    function hide() {
        clearTimeout(hideTimer);
        root.classList.remove('on');
        current = null;
        setTimeout(() => { if (!current) root.innerHTML = ''; }, 800);
    }

    window.Photo = {
        init(el, c) { root = el; cfg = c || {}; },
        show, hide,
        isVisible: () => !!current,
        current: () => current
    };
})();
