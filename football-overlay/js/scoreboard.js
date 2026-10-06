/* =====================================================================
 *  SCOREBOARD.JS — render tên đội, logo, tỷ số, đồng hồ, hiệp, bù giờ.
 *  Chỉ cập nhật DOM khi giá trị thực sự thay đổi (nhẹ cho OBS).
 * ===================================================================== */
(function () {
    'use strict';
    const { esc, pad, fitText } = window.Util;
    const $ = (id) => document.getElementById(id);

    const TEXT_PERIODS = { HT: 'HT', FT: 'FT', PEN: 'PEN' };   // hiện chữ thay cho giờ
    const last = { home: {}, away: {}, score: {}, time: '', period: '', added: null, running: null };
    let root;

    function init() {
        root = $('scoreboard');
    }

    function renderTeam(side, team) {
        const prev = last[side];
        if (prev.name !== team.name) {
            const el = $(`sb-${side}-name`);
            el.textContent = team.name;
            fitText(el, 54, 28);
        }
        if (prev.logo !== team.logo) {
            const img = $(`sb-${side}-logo`);
            const wrap = img.parentElement;
            if (team.logo) {
                wrap.classList.remove('no-logo');
                img.onerror = () => wrap.classList.add('no-logo');
                img.src = team.logo;
            } else {
                wrap.classList.add('no-logo');
                img.removeAttribute('src');
            }
            // tên có thể rộng hơn khi ẩn logo
            requestAnimationFrame(() => fitText($(`sb-${side}-name`), 54, 28));
        }
        if (prev.color !== team.color) {
            const kit = $(`sb-${side}-kit`);
            kit.style.background = team.color
                ? `linear-gradient(180deg, ${team.color}, ${team.color})`
                : 'transparent';
        }
        last[side] = { name: team.name, logo: team.logo, color: team.color };
    }

    /** Đổi số có animation trượt lên. */
    function renderScore(side, value) {
        if (last.score[side] === value) return;
        const box = $(`sb-${side}-score`);
        const first = last.score[side] === undefined;
        last.score[side] = value;
        if (first) {
            box.innerHTML = `<span>${esc(value)}</span>`;
            return;
        }
        box.querySelectorAll('span').forEach((old) => {
            old.className = 'out';
            setTimeout(() => old.remove(), 460);
        });
        const span = document.createElement('span');
        span.className = 'in';
        span.textContent = value;
        box.appendChild(span);
    }

    function formatTime(totalSeconds) {
        const s = Math.max(0, Math.floor(totalSeconds));
        return pad(Math.floor(s / 60)) + ':' + pad(s % 60);
    }

    /** Mỗi ký tự 1 span độ rộng cố định → số không bị "nhảy". */
    function timeHTML(str) {
        return str.split('').map((ch) => ch === ':'
            ? '<span class="c">:</span>'
            : `<span class="d">${ch}</span>`).join('');
    }

    function renderClock(seconds, period, running) {
        const timeEl = $('sb-time');
        const text = TEXT_PERIODS[period] || formatTime(seconds);
        if (text !== last.time) {
            timeEl.innerHTML = TEXT_PERIODS[period] ? `<span class="t">${text}</span>` : timeHTML(text);
            last.time = text;
        }
        if (running !== last.running) {
            timeEl.classList.toggle('running', running);
            timeEl.classList.toggle('paused', !running);
            last.running = running;
        }
    }

    function renderPeriod(period, labels) {
        if (period === last.period) return;
        const el = $('sb-period');
        el.textContent = (labels && labels[period]) || period;
        if (last.period) {
            el.classList.remove('change');
            void el.offsetWidth;          // restart animation
            el.classList.add('change');
        }
        last.period = period;
    }

    function renderAdded(minutes) {
        if (minutes === last.added) return;
        const el = $('sb-added');
        if (minutes > 0) el.textContent = `+${minutes}'`;
        el.classList.toggle('hide', !(minutes > 0));
        last.added = minutes;
    }

    function render(state, labels) {
        renderTeam('home', state.home);
        renderTeam('away', state.away);
        renderScore('home', state.score.home);
        renderScore('away', state.score.away);
        renderPeriod(state.period, labels);
        renderAdded(state.addedTime || 0);
        root.classList.toggle('off', !state.scoreboardVisible);
    }

    /** Hiệu ứng khi có bàn thắng. */
    function flash(side) {
        const team = $(`sb-${side}`);
        const score = $(`sb-${side}-score`);
        [team, score, root].forEach((el) => el.classList.remove('flash', 'goal'));
        void root.offsetWidth;
        team.classList.add('flash');
        score.classList.add('flash');
        root.classList.add('goal');
        clearTimeout(flash._t);
        flash._t = setTimeout(() => {
            team.classList.remove('flash');
            score.classList.remove('flash');
            root.classList.remove('goal');
        }, 3800);
    }

    window.Scoreboard = { init, render, renderClock, flash, formatTime };
})();
