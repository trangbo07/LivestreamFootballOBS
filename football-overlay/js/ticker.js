/* =====================================================================
 *  TICKER.JS — chạy chữ liên tục, không giật khi lặp.
 *
 *  Cách làm: nội dung được lặp đủ rộng hơn khung, nhân đôi thành 2 nhóm
 *  giống hệt nhau, rồi dịch track đúng bằng độ rộng 1 nhóm → vòng lặp
 *  liền mạch. Dùng Web Animations API (transform, chạy trên compositor)
 *  để đổi tốc độ / pause mà không bị nhảy vị trí.
 * ===================================================================== */
(function () {
    'use strict';
    const { esc } = window.Util;

    const BASE_SPEED = 100;     // px/s ứng với playbackRate = 1
    let root, viewport, track;
    let anim = null;
    let groupWidth = 0;
    let speed = 90;
    let direction = 'left';
    let playing = true;
    let items = [];
    let signature = '';

    /** "BREAKING|nội dung" | "nội dung" | {tag, text} → {tag, text} */
    function normalize(m) {
        if (m && typeof m === 'object') return { tag: String(m.tag || '').toUpperCase(), text: String(m.text || '') };
        const s = String(m || '');
        const i = s.indexOf('|');
        if (i > 0 && i <= 12) return { tag: s.slice(0, i).trim().toUpperCase(), text: s.slice(i + 1).trim() };
        return { tag: '', text: s.trim() };
    }

    function itemHTML(m) {
        const slug = m.tag.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const tag = m.tag ? `<span class="tk-tag tag-${slug}">${esc(m.tag)}</span>` : '';
        return `<span class="tk-item">${tag}<span class="tk-text">${esc(m.text)}</span><span class="tk-sep"></span></span>`;
    }

    function progress() {
        if (!anim || !groupWidth) return 0;
        const dur = anim.effect.getTiming().duration;
        return ((anim.currentTime || 0) % dur) / dur;
    }

    function build() {
        const keep = progress();
        if (anim) { anim.cancel(); anim = null; }
        track.innerHTML = '';
        groupWidth = 0;
        if (!items.length) return;

        const group = document.createElement('div');
        group.className = 'tk-group';
        const html = items.map(itemHTML).join('');
        group.innerHTML = html;
        track.appendChild(group);

        // Lặp nội dung cho tới khi nhóm rộng hơn khung hiển thị
        const minWidth = viewport.offsetWidth + 40;
        let n = 1;
        while (group.offsetWidth < minWidth && n < 30) { group.insertAdjacentHTML('beforeend', html); n++; }
        groupWidth = group.offsetWidth;
        track.appendChild(group.cloneNode(true));

        animate(keep);
    }

    function animate(atProgress) {
        if (anim) anim.cancel();
        if (!groupWidth) return;
        const a = 'translateX(0px)';
        const b = `translateX(${-groupWidth}px)`;
        const frames = direction === 'right' ? [{ transform: b }, { transform: a }] : [{ transform: a }, { transform: b }];
        const duration = (groupWidth / BASE_SPEED) * 1000;
        anim = track.animate(frames, { duration, iterations: Infinity, easing: 'linear' });
        anim.currentTime = (atProgress || 0) * duration;
        anim.playbackRate = speed / BASE_SPEED;
        if (!playing) anim.pause();
    }

    function init(el) {
        root = el;
        viewport = el.querySelector('.tk-viewport');
        track = el.querySelector('.tk-track');
        // Đo lại khi font tải xong (độ rộng chữ thay đổi)
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => build());
    }

    /** Áp dụng state.ticker (chỉ build lại khi nội dung đổi). */
    function apply(t) {
        const sig = JSON.stringify(t.messages);
        const dirChanged = t.direction !== direction;
        direction = t.direction === 'right' ? 'right' : 'left';
        setSpeed(t.speed);
        setPlaying(t.running);
        root.classList.toggle('off', !t.visible);
        if (sig !== signature) {
            signature = sig;
            items = (t.messages || []).map(normalize).filter((m) => m.text);
            build();
        } else if (dirChanged) {
            animate(1 - progress());   // đổi chiều nhưng giữ vị trí hiện tại
        }
    }

    function setSpeed(v) {
        speed = Math.max(5, Number(v) || 90);
        if (anim) anim.updatePlaybackRate ? anim.updatePlaybackRate(speed / BASE_SPEED) : (anim.playbackRate = speed / BASE_SPEED);
    }

    function setPlaying(on) {
        playing = !!on;
        root.classList.toggle('paused', !playing);
        if (!anim) return;
        if (playing && anim.playState !== 'running') anim.play();
        if (!playing && anim.playState === 'running') anim.pause();
    }

    function setLiveOffset(on) {
        if (root.classList.contains('with-live') === !!on) return;
        root.classList.toggle('with-live', !!on);
        setTimeout(build, 560);    // đo lại sau khi khung co giãn xong
    }

    window.Ticker = { init, apply, normalize, setLiveOffset, rebuild: build };
})();
