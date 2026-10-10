/* =====================================================================
 *  CONFIG.JS — TOÀN BỘ DỮ LIỆU CẦN THAY ĐỔI NẰM Ở ĐÂY
 *  Sửa file này rồi refresh overlay (OBS: chuột phải source → Refresh).
 *  Khi config thay đổi, trạng thái đã lưu (tỷ số, thời gian…) sẽ được
 *  reset về giá trị trong file này.
 * ===================================================================== */
window.CONFIG = {

    channelName: "ME SPORT",

    /* ---------------- GIAO DIỆN ----------------
     * "neon"    — kính tối + cyan/hồng neon (mặc định)
     * "premier" — tím đậm + xanh neon kiểu Ngoại hạng Anh
     * "gold"    — đen nhám + vàng kim
     * "classic" — navy + đỏ + viền trắng (bản cũ)
     * "albiceleste" — xanh da trời + trắng + vàng (Argentina)
     * "alnassr" — vàng + xanh hoàng gia + navy (Al-Nassr / CR7)
     * Đổi nhanh trong control panel, không cần sửa file.                 */
    theme: "alnassr",

    /* ---------------- YOUTUBE LIVE CHAT ----------------
     * Bình luận thật trên YouTube hiện lên khung chat (cần chạy server.js).
     * source: link video live, ID video, hoặc link kênh (@tenkenh) — có thể
     *         để trống và dán link trong control panel.
     * apiKey: để "" = đọc chat trực tiếp, KHÔNG cần key (khuyên dùng).
     *         Có key YouTube Data API v3 thì dùng API chính thức (tốn quota).
     * autoConnect: tự kết nối khi bật server.                           */
    youtube: {
        source: "",
        apiKey: "",
        autoConnect: false,
        maxPerPoll: 25
    },

    /* ---------------- OBS (thu nhỏ camera thật khi bật chế độ phân tích) ----
     * Cần OBS 28+: Tools → WebSocket Server Settings → Enable.
     * cameraSource: TÊN source camera trong OBS (đúng chữ hoa/thường).
     * scene: để "" = scene đang phát.                                       */
    obs: {
        enabled: false,
        url: "ws://127.0.0.1:4455",
        password: "",
        scene: "",
        animateMs: 900
    },

    /* ---------------- 2 CAMERA (cần kết nối OBS ở trên) ----------------
     * sources: TÊN 2 source camera trong OBS (đúng chữ hoa/thường), cả 2
     *          phải nằm trong cùng scene, dưới source overlay.
     * start: bố cục lúc đầu — close | wide | pip | pip2 | split
     *        (photo / photo2 = cam cận / toàn cảnh bên trái + ảnh trận đấu bên phải)
     * auto: tự chuyển cam theo diễn biến ("" = không đổi)
     *       lineup: khi hiện đội hình (trả lại cam cũ khi ẩn)
     *       goal: khi có bàn thắng, giữ goalHold giây rồi trả lại
     *       halfTime / fullTime / matchStart: khi nghỉ / hết trận / bắt đầu
     * rects: vị trí khung PiP và chia đôi (pixel trên canvas 1920x1080)   */
    cameras: {
        sources: { close: "Cam can", wide: "Cam toan canh" },
        labels: { close: "CAM CẬN", wide: "TOÀN CẢNH" },
        start: "close",
        auto: {
            enabled: true, lineup: "wide", goal: "close", goalHold: 8, halfTime: "close", fullTime: "close", matchStart: "wide",
            sceneAnalysis: "",   // bật chế độ phân tích → chuyển sang scene này (vd. "Scene 2"); "" = không đổi scene
            sceneNormal: ""      // tắt chế độ phân tích → về scene này; "" = về scene trước đó
        },
        rects: {
            pip: { x: 1452, y: 64, w: 408, h: 230 },
            left: { x: 68, y: 250, w: 880, h: 495 },     // nằm dưới logo kênh, trên scoreboard
            right: { x: 972, y: 250, w: 880, h: 495 }
        }
    },

    /* ---------------- CHẾ ĐỘ PHÂN TÍCH ----------------
     * camera: vị trí khung camera thu nhỏ (pixel trên canvas 1920x1080).
     * statKeys: thứ tự các dòng thống kê.                                  */
    analysis: {
        camera: { x: 250, y: 64, w: 1100, h: 619 },
        cameraSmall: { x: 1390, y: 56, w: 470, h: 264 },   // kiểu "heatmap lớn": camera thu vào góc phải
        heatRotateSec: 10,
        statKeys: ["possession", "shots", "onTarget", "corners", "fouls", "yellow", "red"]
    },

    /* ---------------- ĐỘI HÌNH RA SÂN ----------------
     * formation: sơ đồ (tổng = 10 cầu thủ ngoài thủ môn).
     * players: 11 người — thủ môn trước, rồi hậu vệ (phải → trái),
     *          tiền vệ, tiền đạo. Dạng "số|họ tên|tên ngắn".               */
    lineups: {
        home: {
            formation: "4-3-3",
            coach: "",
            players: [
                "|BENTO|BENTO",
                "|NAWAF BOUSHAL|BOUSHAL",
                "|MOHAMED SIMAKAN|SIMAKAN",
                "|AYMERIC LAPORTE|LAPORTE",
                "|SALEM AL-NAJDI|AL-NAJDI",
                "|ABDULLAH AL-KHAIBARI|AL-KHAIBARI",
                "|SAMU COSTA|SAMU COSTA",
                "11|MARCELO BROZOVIĆ|BROZOVIĆ",
                "10|SADIO MANÉ|MANÉ",
                "|JOÃO FÉLIX|JOÃO FÉLIX",
                "7|CRISTIANO RONALDO (C)|RONALDO"
            ],
            subs: []
        },
        away: {
            formation: "4-3-3",
            coach: "",
            players: [
                "|NIKOLA VASILJ|VASILJ",
                "|ABDULAZIZ AL-FARAJ|AL-FARAJ",
                "|CHANCEL MBEMBA|MBEMBA",
                "|BERAT DJIMSITI|DJIMSITI",
                "|HUSSAIN AL-SIBYANI|AL-SIBYANI",
                "|IDRISSA GUEYE|GUEYE",
                "|ABDULELAH AL-MALKI|AL-MALKI",
                "|ENZO MILLOT|MILLOT",
                "|ADIL BOULBINA|BOULBINA",
                "|DARWIN NÚÑEZ|NÚÑEZ",
                "|CLAYTON DIANDY|DIANDY"
            ],
            subs: []
        }
    },

    /* ---------------- ĐẾM NGƯỢC TRƯỚC TRẬN ---------------- */
    countdown: {
        title: "AL-NASSR - AL-DIRIYAH • ĐÊM CỦA CR7",
        sub: "#SIUUU — ĐĂNG KÝ KÊNH & BẬT CHUÔNG ĐỂ KHÔNG BỎ LỠ"
    },

    /* ---------------- ĐỘI BÓNG ----------------
     * logo: đường dẫn PNG/SVG/JPG (tương đối với index.html) hoặc URL.
     * color: màu chủ đạo (vạch màu dưới scoreboard, popup).            */
    homeTeam: {
        name: "AL-NASSR",
        short: "AL-NASSR",
        logo: "./assets/alnassr.svg",
        color: "#ffc80a"
    },

    awayTeam: {
        name: "AL-DIRIYAH",
        short: "DIRIYAH",
        logo: "./assets/diriyah.svg",
        color: "#0d3b2e"
    },

    score: {
        home: 0,
        away: 0
    },

    /* period: "1H" | "HT" | "2H" | "ET1" | "ET2" | "FT" | "PEN"          */
    match: {
        minute: 0,
        second: 0,
        period: "1H",
        addedTime: 0,        // bù giờ (phút) — 0 = ẩn
        autoStart: false     // tự chạy đồng hồ khi mở overlay
    },

    /* Nhãn hiển thị cho từng hiệp (tab đỏ phía trên đồng hồ) */
    periodLabels: {
        "1H": "HIỆP 1",
        "HT": "NGHỈ GIỮA HIỆP",
        "2H": "HIỆP 2",
        "ET1": "HIỆP PHỤ 1",
        "ET2": "HIỆP PHỤ 2",
        "FT": "KẾT THÚC",
        "PEN": "LUÂN LƯU"
    },

    live: true,

    /* Khung viền xanh navy quanh màn hình (giống hình tham khảo) */
    frame: {
        enabled: true
    },

    /* ---------------- LOGO / WATERMARK (góc trên trái) ---------------- */
    watermark: {
        enabled: true,
        logo: "./assets/me-sport.svg",   // để "" nếu chỉ muốn hiện chữ
        title: "ME SPORT",  // hiện khi không có logo
        line1: "HƠN 206K",
        line2: "NGƯỜI ĐĂNG KÝ",
        opacity: 0.95
    },

    /* ---------------- NGÀY THÁNG (góc dưới trái) ----------------------
     * mode: "auto" lấy ngày hệ thống | "manual" dùng giá trị manual      */
    date: {
        enabled: true,
        mode: "auto",
        manual: { day: 5, month: 10, year: 2026 }
    },

    /* ---------------- TICKER / CHẠY CHỮ -------------------------------
     * speed: pixel / giây, bội số của 30 cho mượt (60 = vừa, 90 = hơi nhanh, 120 = nhanh)
     * direction: "left" (phải → trái) | "right"
     * messages: chuỗi, "TAG|nội dung", hoặc { tag, text }
     * TAG hỗ trợ: LIVE, BREAKING, NEWS, FULL TIME, TRANSFER, UPDATE      */
    ticker: {
        enabled: true,
        speed: 60,
        direction: "left",
        autoGoalNews: true,          // tự thêm tin khi có bàn thắng
        messages: [
            { tag: "LIVE", text: "AL-NASSR - AL-DIRIYAH • SAUDI PRO LEAGUE • VÒNG 8 • 01:00 NGÀY 10.10.2026 (GIỜ VN)" },
            { tag: "BREAKING", text: "CRISTIANO RONALDO TRỞ LẠI ĐỘI HÌNH AL-NASSR — #SIUUU" },
            { tag: "NEWS", text: "CR7: 5 QUẢ BÓNG VÀNG • 5 CHAMPIONS LEAGUE • VÔ ĐỊCH EURO 2016 • 2 NATIONS LEAGUE" },
            { tag: "UPDATE", text: "AL-NASSR (HẠNG 3, 16 ĐIỂM) TIẾP AL-DIRIYAH (HẠNG 8, 11 ĐIỂM)" },
            "ME SPORT — CỔ VŨ CR7 Ở KHUNG CHAT NHÉ! SIUUU!"
        ]
    },

    /* ---------------- CHAT ---------------------------------------------
     * fakeChat: tự sinh bình luận giả (luôn bật khi DEMO MODE).
     * messageLifetime: ms, tin nhắn tự biến mất sau thời gian này (0 = không).
     * websocketUrl: kết nối chat thật. Server gửi JSON {user, text, color?}
     *               hoặc mảng các object đó. Để "" để tắt.                 */
    chat: {
        enabled: true,
        maxMessages: 5,
        messageLifetime: 0,
        showAvatars: true,          // hiện ảnh đại diện YouTube
        bannedWords: [],            // vd. ["từ xấu", "spam"] — bị che bằng ***
        filterMode: "mask",         // "mask" = che ***, "hide" = ẩn cả tin
        fakeChat: false,
        fakeInterval: [1600, 4200],
        websocketUrl: "",
        messages: [
            { user: "marksmith2972", text: "The only way to do that day but you can just" },
            { user: "tinho4063", text: "hello" }
        ],
        fakeUsers: [
            "marksmith2972", "tinho4063", "masmasx1262", "SvDj-u5y7v", "hoanganh.fc",
            "minhtuan_99", "thuytrang2911", "bongda4ever", "ultra.vn", "nguyenvanbinh",
            "lehoang.k", "fanbongda_hn", "cr7fan_vn", "gooner1886"
        ],
        fakeMessages: [
            "SIUUUUU! 🐐", "Vamos Al-Nassr 💛💙", "hello mọi người",
            "Ronaldo đá phạt đi anh ơi", "Thủ môn Diriyah bắt hay quá", "CR7 mãi đỉnh ❤️",
            "Số 7 vĩ đại nhất", "Mané nhanh ghê", "GOOOOOAL sắp tới rồi",
            "Xem từ Đà Nẵng nè", "Diriyah chơi rát quá", "Ai dự đoán tỷ số đi",
            "3-0 cho Al-Nassr nhé", "#SIUUU", "Bình luận viên nhiệt quá 🔥"
        ]
    },

    /* ---------------- LOWER THIRD -------------------------------------- */
    lowerThird: {
        duration: 5000,    // ms tự ẩn. 0 = giữ đến khi bấm Hide
        default: { name: "CRISTIANO RONALDO", role: "ĐỘI TRƯỞNG", team: "AL-NASSR" }
    },

    /* ---------------- POPUP (thời gian hiển thị, ms) -------------------- */
    popup: {
        goal: 5000,
        card: 4200,
        substitution: 5000,
        status: 4200,
        stats: 9000
    },

    /* ---------------- ỦNG HỘ / DONATION --------------------------------
     * qrImage: đường dẫn ảnh QR của bạn. Để "" sẽ tự tạo QR qua VietQR
     *          (img.vietqr.io) từ bankId + accountNo + content (cần internet).
     * bankId: mã VietQR của ngân hàng (TCB, VCB, MB, ACB, BIDV, VPB, TPB…)
     * duration: ms tự ẩn (0 = giữ). interval: tự hiện mỗi N giây (0 = tắt) */
    donation: {
        title: "ỦNG HỘ CHÚNG TÔI",
        bankName: "TECHCOMBANK",
        bankId: "TCB",
        accountNo: "1903 6688 8888",
        accountName: "KENH THE THAO 24H",
        content: "UNG HO KENH 24H",
        qrImage: "",
        duration: 20000,
        interval: 0
    },

    /* ---------------- SOCIAL / FOLLOW US -------------------------------- */
    social: {
        title: "FOLLOW US",
        duration: 9000,
        interval: 0,
        items: [
            { platform: "youtube", label: "YouTube", handle: "@KenhTheThao24H" },
            { platform: "facebook", label: "Facebook", handle: "fb.com/kenhthethao24h" },
            { platform: "tiktok", label: "TikTok", handle: "@thethao24h.live" }
        ]
    },

    /* ---------------- PHÍM TẮT (dùng trong overlay khi nhấn G/Y/R/S...) -- */
    shortcuts: {
        goalPlayer: { home: "", away: "" },
        cardPlayer: "PLAYER NAME",
        subOut: "PLAYER A",
        subIn: "PLAYER B"
    },

    /* ---------------- KHUNG ẢNH TRẬN ĐẤU (phía trên khung chat) ----------
     * Đăng ảnh trong control panel → mục "Khung ảnh trận đấu", phím tắt P.
     * duration: ms tự ẩn mỗi lần hiện ảnh, 0 = giữ đến khi bấm Ẩn.          */
    photo: {
        title: "KHOẢNH KHẮC TRẬN ĐẤU",
        defaultCaption: "AL-NASSR - AL-DIRIYAH • ME SPORT",
        duration: 15000
    },

    /* ---------------- TRI ÂN HUYỀN THOẠI (banner CR7) ----------------
     * Điều khiển trong control panel → mục "Đêm của CR7", phím tắt M = thẻ CR7.
     * player.photo: ảnh PNG đã tách nền, đặt vào assets/cr7.png.
     *               Không có ảnh → tự vẽ lưng áo vàng RONALDO 7.
     * matchName: tên cầu thủ khớp (regex) → bàn thắng dùng màn goalWord
     *            (autoGoal), bị thay ra dùng màn standing ovation (autoOvation).
     * rankLabel: nhãn thứ hạng ở màn hình trận đấu (homeRank / awayRank).
     * durations: ms tự ẩn mỗi cảnh, 0 = giữ đến khi bấm Ẩn.                  */
    tribute: {
        badge: true,
        hashtag: "#SIUUU",
        badgeText: "ĐÊM CỦA CR7",
        eventTitle: "ĐÊM CỦA CR7",
        legendKicker: "HUYỀN THOẠI SỐ 7",
        goalWord: "SIUUU!",
        rankLabel: "BXH SAUDI PRO LEAGUE",
        matchName: "RONALDO|CR7",
        autoGoal: true,
        autoOvation: true,
        player: {
            name: "CRISTIANO RONALDO",
            fullName: "CRISTIANO RONALDO",
            shirtName: "RONALDO",
            number: 7,
            nickname: "CR7",
            role: "ĐỘI TRƯỞNG AL-NASSR",
            badge: "CAPTAIN",
            photo: "./assets/cr7.png"
        },
        match: {
            competition: "SAUDI PRO LEAGUE • VÒNG 8",
            date: "10.10.2026",
            time: "01:00",
            venue: "RIYADH",
            homeRank: 3,
            awayRank: 8
        },
        honours: [
            { n: "5", label: "QUẢ BÓNG VÀNG", sub: "2008 • 13 • 14 • 16 • 17" },
            { n: "5", label: "CHAMPIONS LEAGUE", sub: "MAN UTD • REAL MADRID" },
            { n: "1", label: "EURO", sub: "PHÁP 2016" },
            { n: "2", label: "NATIONS LEAGUE", sub: "2019 • 2025" },
            { n: "4", label: "CHIẾC GIÀY VÀNG", sub: "CHÂU ÂU" },
            { n: "900+", label: "BÀN THẮNG", sub: "KỶ LỤC SỰ NGHIỆP" }
        ],
        timeline: [
            { year: "2003", text: "Từ Sporting tới Man Utd, ra mắt ĐT Bồ Đào Nha" },
            { year: "2008", text: "Champions League + Quả bóng vàng đầu tiên" },
            { year: "2016", text: "Vô địch EURO cùng Bồ Đào Nha" },
            { year: "2018", text: "Champions League thứ 5, rời Real Madrid" },
            { year: "2023", text: "Gia nhập Al-Nassr" }
        ],
        cardFacts: ["5× QUẢ BÓNG VÀNG", "5× CHAMPIONS LEAGUE", "VÔ ĐỊCH EURO 2016"],
        ovationTitle: "CẢM ƠN, CR7!",
        ovationText: "KHÁN GIẢ ĐỨNG DẬY TRI ÂN SỐ 7 HUYỀN THOẠI",
        thanks: {
            script: "Obrigado, Cristiano",
            title: "CẢM ƠN VÌ HƠN 20 NĂM CỐNG HIẾN CHO BÓNG ĐÁ",
            sub: "MÃI MÃI LÀ SỐ 7"
        },
        durations: { matchday: 0, legend: 0, card: 9000, goal: 9000, ovation: 9000, thanks: 0 }
    },

    /* ---------------- BẢN TIẾNG ANH ----------------------------------------
     * Mở overlay bằng  http://localhost:3000/?demo=0&lang=en  để hiện tiếng Anh
     * (dùng chung control panel, tỷ số, đồng hồ với bản tiếng Việt).
     * Khối dưới đây có CÙNG CẤU TRÚC với phần trên: mỗi chuỗi là bản dịch của
     * chuỗi ở đúng vị trí đó. Thiếu bản dịch → giữ nguyên chữ gốc.
     * Nhãn giao diện cố định (THỐNG KÊ, ĐỘI HÌNH…) đã có sẵn trong js/i18n.js. */
    english: {
        homeTeam: { name: "AL-NASSR" },
        awayTeam: { name: "AL-DIRIYAH" },
        periodLabels: {
            "1H": "1ST HALF", "HT": "HALF-TIME", "2H": "2ND HALF",
            "ET1": "EXTRA TIME 1", "ET2": "EXTRA TIME 2", "FT": "FULL-TIME", "PEN": "PENALTIES"
        },
        watermark: { line1: "206K+", line2: "SUBSCRIBERS" },
        countdown: {
            title: "AL-NASSR - AL-DIRIYAH • CR7 NIGHT",
            sub: "#SIUUU — SUBSCRIBE & TURN ON NOTIFICATIONS"
        },
        ticker: {
            messages: [
                { text: "AL-NASSR - AL-DIRIYAH • SAUDI PRO LEAGUE • MATCHDAY 8 • 09.10.2026, 21:00 RIYADH TIME" },
                { text: "CRISTIANO RONALDO IS BACK IN THE AL-NASSR LINE-UP — #SIUUU" },
                { text: "CR7: 5 BALLON D'ORS • 5 CHAMPIONS LEAGUES • EURO 2016 WINNER • 2 NATIONS LEAGUES" },
                { text: "AL-NASSR (3RD, 16 PTS) HOST AL-DIRIYAH (8TH, 11 PTS)" },
                "ME SPORT — CHEER FOR CR7 IN THE CHAT! SIUUU!"
            ]
        },
        lowerThird: { default: { role: "CAPTAIN" } },
        tribute: {
            badgeText: "CR7 NIGHT",
            eventTitle: "CR7 NIGHT",
            legendKicker: "THE NUMBER 7 LEGEND",
            rankLabel: "SAUDI PRO LEAGUE",
            player: { role: "AL-NASSR CAPTAIN" },
            match: { competition: "SAUDI PRO LEAGUE • MATCHDAY 8", date: "09.10.2026", time: "21:00 (RIYADH)" },
            honours: [
                { label: "BALLON D'OR", sub: "2008 • 13 • 14 • 16 • 17" },
                { label: "CHAMPIONS LEAGUE", sub: "MAN UTD • REAL MADRID" },
                { label: "EURO", sub: "FRANCE 2016" },
                { label: "NATIONS LEAGUE", sub: "2019 • 2025" },
                { label: "GOLDEN SHOES", sub: "EUROPEAN" },
                { label: "CAREER GOALS", sub: "ALL-TIME RECORD" }
            ],
            timeline: [
                { text: "Sporting to Man Utd, senior Portugal debut" },
                { text: "Champions League + first Ballon d'Or" },
                { text: "Wins EURO with Portugal" },
                { text: "Fifth Champions League, leaves Real Madrid" },
                { text: "Joins Al-Nassr" }
            ],
            cardFacts: ["5× BALLON D'OR", "5× CHAMPIONS LEAGUE", "EURO 2016 WINNER"],
            ovationTitle: "THANK YOU, CR7!",
            ovationText: "THE CROWD RISES FOR THE NUMBER 7 LEGEND",
            thanks: {
                title: "THANK YOU FOR OVER 20 YEARS OF FOOTBALL GREATNESS",
                sub: "FOREVER NUMBER 7"
            }
        }
    },

    /* ---------------- DEMO MODE ---------------------------------------
     * autoStart: tự chạy demo khi mở index.html lần đầu.
     * Khi livestream thật: tắt DEMO trong control panel (được ghi nhớ),
     * hoặc dùng URL index.html?demo=0                                    */
    demo: {
        autoStart: false,
        players: {
            home: ["CRISTIANO RONALDO", "SADIO MANÉ", "JOÃO FÉLIX", "MARCELO BROZOVIĆ"],
            away: ["DARWIN NÚÑEZ", "ENZO MILLOT", "IDRISSA GUEYE", "ADIL BOULBINA"]
        },
        commentator: { name: "ME SPORT", role: "BÌNH LUẬN VIÊN", team: "ME SPORT" }
    }
};
