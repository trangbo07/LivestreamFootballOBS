/* =====================================================================
 *  CONFIG.JS — TOÀN BỘ DỮ LIỆU CẦN THAY ĐỔI NẰM Ở ĐÂY
 *  Sửa file này rồi refresh overlay (OBS: chuột phải source → Refresh).
 *  Khi config thay đổi, trạng thái đã lưu (tỷ số, thời gian…) sẽ được
 *  reset về giá trị trong file này.
 * ===================================================================== */
window.CONFIG = {

    channelName: "NEXT FOOTBALL",

    /* ---------------- GIAO DIỆN ----------------
     * "neon"    — kính tối + cyan/hồng neon (mặc định)
     * "premier" — tím đậm + xanh neon kiểu Ngoại hạng Anh
     * "gold"    — đen nhám + vàng kim
     * "classic" — navy + đỏ + viền trắng (bản cũ)
     * "albiceleste" — xanh da trời + trắng + vàng (Argentina)
     * Đổi nhanh trong control panel, không cần sửa file.                 */
    theme: "albiceleste",

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
        heatRotateSec: 10,
        statKeys: ["possession", "shots", "onTarget", "corners", "fouls", "yellow", "red"]
    },

    /* ---------------- ĐỘI HÌNH RA SÂN ----------------
     * formation: sơ đồ (tổng = 10 cầu thủ ngoài thủ môn).
     * players: 11 người — thủ môn trước, rồi hậu vệ (phải → trái),
     *          tiền vệ, tiền đạo. Dạng "số|họ tên|tên ngắn".               */
    lineups: {
        home: {
            formation: "4-4-2",
            coach: "LIONEL SCALONI",
            players: [
                "23|EMILIANO MARTÍNEZ|E. MARTÍNEZ",
                "4|AGUSTÍN GIAY|GIAY",
                "13|CRISTIAN ROMERO|ROMERO",
                "6|LISANDRO MARTÍNEZ|L. MARTÍNEZ",
                "33|VEGA|VEGA",
                "18|NICO PAZ|PAZ",
                "8|ENZO FERNÁNDEZ|FERNÁNDEZ",
                "20|ALEXIS MAC ALLISTER|MAC ALLISTER",
                "16|GIANLUCA PRESTIANNI|PRESTIANNI",
                "9|JULIÁN ÁLVAREZ|ÁLVAREZ",
                "10|LIONEL MESSI (C)|MESSI"
            ],
            subs: []
        },
        away: {
            formation: "4-1-4-1",
            coach: "",
            players: [
                "1|MARCEL DANDJINOU|DANDJINOU",
                "12|AZONGNI|AZONGNI",
                "5|YOHAN ROCHE|ROCHE",
                "13|MOHAMED TIJANI|TIJANI",
                "3|TAMIMOU OUOROU|T. OUOROU",
                "15|SESSI D'ALMEIDA|D'ALMEIDA",
                "6|Y. OUOROU|Y. OUOROU",
                "8|HASSANE IMOURANE|IMOURANE",
                "18|OLAITAN|OLAITAN",
                "17|ALOKO|ALOKO",
                "10|TOSIN AIYEGUN|TOSIN"
            ],
            subs: []
        }
    },

    /* ---------------- ĐẾM NGƯỢC TRƯỚC TRẬN ---------------- */
    countdown: {
        title: "ARGENTINA - BENIN • ĐÊM TRI ÂN MESSI",
        sub: "#GRACIASLEO — ĐĂNG KÝ KÊNH & BẬT CHUÔNG ĐỂ KHÔNG BỎ LỠ"
    },

    /* ---------------- ĐỘI BÓNG ----------------
     * logo: đường dẫn PNG/SVG/JPG (tương đối với index.html) hoặc URL.
     * color: màu chủ đạo (vạch màu dưới scoreboard, popup).            */
    homeTeam: {
        name: "ĐT ARGENTINA",
        short: "ARGENTINA",
        logo: "./assets/argentina.svg",
        color: "#75aadb"
    },

    awayTeam: {
        name: "ĐT BENIN",
        short: "BENIN",
        logo: "./assets/benin.svg",
        color: "#008751"
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
        logo: "./assets/next-football.svg",   // để "" nếu chỉ muốn hiện chữ
        title: "NEXT FOOTBALL",  // hiện khi không có logo
        line1: "HƠN 350K",
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
            { tag: "LIVE", text: "ARGENTINA - BENIN • GIAO HỮU QUỐC TẾ • 07.10.2026" },
            { tag: "BREAKING", text: "ĐÊM TRI ÂN LIONEL MESSI — #GRACIASLEO" },
            { tag: "NEWS", text: "MESSI: 8 QUẢ BÓNG VÀNG • VÔ ĐỊCH WORLD CUP 2022 • 2 COPA AMÉRICA (2021, 2024)" },
            { tag: "UPDATE", text: "ARGENTINA (FIFA #2) ĐỐI ĐẦU BENIN (FIFA #93)" },
            "NEXT FOOTBALL — GỬI LỜI TRI ÂN TỚI MESSI Ở KHUNG CHAT NHÉ!"
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
            "Gracias Leo! 🐐", "Vamos Argentina 🇦🇷", "hello mọi người",
            "Messi đá phạt đi anh ơi", "Thủ môn Benin bắt hay quá", "Cảm ơn Messi vì tất cả ❤️",
            "Số 10 vĩ đại nhất", "Julián Álvarez nhanh ghê", "GOOOOOAL sắp tới rồi",
            "Xem từ Đà Nẵng nè", "Benin chơi rát quá", "Ai dự đoán tỷ số đi",
            "3-0 cho Argentina nhé", "#GraciasLeo", "Bình luận viên nhiệt quá 🔥"
        ]
    },

    /* ---------------- LOWER THIRD -------------------------------------- */
    lowerThird: {
        duration: 5000,    // ms tự ẩn. 0 = giữ đến khi bấm Hide
        default: { name: "LIONEL MESSI", role: "ĐỘI TRƯỞNG", team: "ARGENTINA" }
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
        defaultCaption: "ARGENTINA - BENIN • NEXT FOOTBALL",
        duration: 15000
    },

    /* ---------------- TRI ÂN HUYỀN THOẠI (banner Messi) ----------------
     * Điều khiển trong control panel → mục "Tri ân Messi", phím tắt M = thẻ Messi.
     * player.photo: ảnh PNG đã tách nền, đặt vào assets/messi.png.
     *               Không có ảnh → tự vẽ lưng áo MESSI 10.
     * matchName: tên cầu thủ khớp (regex) → bàn thắng dùng màn GOLAZO
     *            (autoGoal), bị thay ra dùng màn standing ovation (autoOvation).
     * durations: ms tự ẩn mỗi cảnh, 0 = giữ đến khi bấm Ẩn.                  */
    tribute: {
        badge: true,
        hashtag: "#GRACIASLEO",
        badgeText: "ĐÊM TRI ÂN MESSI",
        eventTitle: "ĐÊM TRI ÂN HUYỀN THOẠI",
        legendKicker: "HUYỀN THOẠI SỐ 10",
        matchName: "MESSI",
        autoGoal: true,
        autoOvation: true,
        player: {
            name: "LIONEL MESSI",
            fullName: "LIONEL ANDRÉS MESSI",
            shirtName: "MESSI",
            number: 10,
            nickname: "LA PULGA",
            role: "ĐỘI TRƯỞNG ARGENTINA",
            badge: "CAPTAIN",
            photo: "./assets/messi.png"
        },
        match: {
            competition: "GIAO HỮU QUỐC TẾ",
            date: "07.10.2026",
            time: "06:00",
            venue: "",
            homeRank: 2,
            awayRank: 93
        },
        honours: [
            { n: "8", label: "QUẢ BÓNG VÀNG", sub: "KỶ LỤC MỌI THỜI ĐẠI" },
            { n: "1", label: "WORLD CUP", sub: "QATAR 2022" },
            { n: "2", label: "COPA AMÉRICA", sub: "2021 • 2024" },
            { n: "1", label: "FINALISSIMA", sub: "WEMBLEY 2022" },
            { n: "1", label: "HCV OLYMPIC", sub: "BẮC KINH 2008" },
            { n: "6", label: "CHIẾC GIÀY VÀNG", sub: "CHÂU ÂU" }
        ],
        timeline: [
            { year: "2005", text: "Vô địch U20 thế giới, ra mắt ĐT Argentina" },
            { year: "2008", text: "Huy chương vàng Olympic Bắc Kinh" },
            { year: "2021", text: "Copa América — danh hiệu đầu tiên cùng ĐT" },
            { year: "2022", text: "Nâng cúp vàng World Cup tại Qatar" },
            { year: "2024", text: "Bảo vệ thành công Copa América" }
        ],
        cardFacts: ["8× QUẢ BÓNG VÀNG", "VÔ ĐỊCH WORLD CUP 2022", "2× COPA AMÉRICA"],
        ovationTitle: "CẢM ƠN, LEO!",
        ovationText: "KHÁN GIẢ ĐỨNG DẬY TRI ÂN SỐ 10 HUYỀN THOẠI",
        thanks: {
            script: "Gracias, Leo",
            title: "CẢM ƠN VÌ NHỮNG KÝ ỨC ĐẸP NHẤT CỦA BÓNG ĐÁ",
            sub: "MÃI MÃI LÀ SỐ 10"
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
        homeTeam: { name: "ARGENTINA" },
        awayTeam: { name: "BENIN" },
        periodLabels: {
            "1H": "1ST HALF", "HT": "HALF-TIME", "2H": "2ND HALF",
            "ET1": "EXTRA TIME 1", "ET2": "EXTRA TIME 2", "FT": "FULL-TIME", "PEN": "PENALTIES"
        },
        watermark: { line1: "350K+", line2: "SUBSCRIBERS" },
        countdown: {
            title: "ARGENTINA - BENIN • MESSI TRIBUTE NIGHT",
            sub: "#GRACIASLEO — SUBSCRIBE & TURN ON NOTIFICATIONS"
        },
        ticker: {
            messages: [
                { text: "ARGENTINA - BENIN • INTERNATIONAL FRIENDLY • 07.10.2026" },
                { text: "A TRIBUTE NIGHT FOR LIONEL MESSI — #GRACIASLEO" },
                { text: "MESSI: 8 BALLON D'ORS • 2022 WORLD CUP WINNER • 2 COPA AMÉRICAS (2021, 2024)" },
                { text: "ARGENTINA (FIFA #2) TAKE ON BENIN (FIFA #93)" },
                "NEXT FOOTBALL — SEND YOUR TRIBUTE TO MESSI IN THE CHAT!"
            ]
        },
        lowerThird: { default: { role: "CAPTAIN" } },
        tribute: {
            badgeText: "MESSI TRIBUTE NIGHT",
            eventTitle: "A TRIBUTE TO A LEGEND",
            legendKicker: "THE NUMBER 10 LEGEND",
            player: { role: "ARGENTINA CAPTAIN" },
            match: { competition: "INTERNATIONAL FRIENDLY" },
            honours: [
                { label: "BALLON D'OR", sub: "ALL-TIME RECORD" },
                { label: "WORLD CUP", sub: "QATAR 2022" },
                { label: "COPA AMÉRICA", sub: "2021 • 2024" },
                { label: "FINALISSIMA", sub: "WEMBLEY 2022" },
                { label: "OLYMPIC GOLD", sub: "BEIJING 2008" },
                { label: "GOLDEN SHOES", sub: "EUROPEAN" }
            ],
            timeline: [
                { text: "U-20 World Cup winner, senior Argentina debut" },
                { text: "Olympic gold medal in Beijing" },
                { text: "Copa América — first major title with Argentina" },
                { text: "Lifts the World Cup in Qatar" },
                { text: "Retains the Copa América" }
            ],
            cardFacts: ["8× BALLON D'OR", "2022 WORLD CUP WINNER", "2× COPA AMÉRICA"],
            ovationTitle: "THANK YOU, LEO!",
            ovationText: "THE CROWD RISES FOR THE NUMBER 10 LEGEND",
            thanks: {
                title: "THANK YOU FOR FOOTBALL'S MOST BEAUTIFUL MEMORIES",
                sub: "FOREVER NUMBER 10"
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
            home: ["LIONEL MESSI", "JULIÁN ÁLVAREZ", "ALEXIS MAC ALLISTER", "NICO PAZ"],
            away: ["TOSIN AIYEGUN", "HASSANE IMOURANE", "SESSI D'ALMEIDA", "YOHAN ROCHE"]
        },
        commentator: { name: "NEXT FOOTBALL", role: "BÌNH LUẬN VIÊN", team: "NEXT FOOTBALL" }
    }
};
