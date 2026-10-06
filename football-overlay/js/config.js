/* =====================================================================
 *  CONFIG.JS — TOÀN BỘ DỮ LIỆU CẦN THAY ĐỔI NẰM Ở ĐÂY
 *  Sửa file này rồi refresh overlay (OBS: chuột phải source → Refresh).
 *  Khi config thay đổi, trạng thái đã lưu (tỷ số, thời gian…) sẽ được
 *  reset về giá trị trong file này.
 * ===================================================================== */
window.CONFIG = {

    channelName: "KÊNH THỂ THAO 24H",

    /* ---------------- GIAO DIỆN ----------------
     * "neon"    — kính tối + cyan/hồng neon (mặc định)
     * "premier" — tím đậm + xanh neon kiểu Ngoại hạng Anh
     * "gold"    — đen nhám + vàng kim
     * "classic" — navy + đỏ + viền trắng (bản cũ)
     * Đổi nhanh trong control panel, không cần sửa file.                 */
    theme: "neon",

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
            left: { x: 40, y: 150, w: 912, h: 513 },
            right: { x: 968, y: 150, w: 912, h: 513 }
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
            formation: "3-4-3",
            coach: "KIM SANG-SIK",
            players: [
                "1|NGUYỄN FILIP|FILIP",
                "4|BÙI TIẾN DŨNG|TIẾN DŨNG",
                "3|NGUYỄN THÀNH CHUNG|THÀNH CHUNG",
                "2|ĐỖ DUY MẠNH|DUY MẠNH",
                "17|VŨ VĂN THANH|VĂN THANH",
                "8|NGUYỄN HOÀNG ĐỨC|HOÀNG ĐỨC",
                "14|NGUYỄN HAI LONG|HAI LONG",
                "7|ĐOÀN VĂN HẬU|VĂN HẬU",
                "19|NGUYỄN QUANG HẢI|QUANG HẢI",
                "12|NGUYỄN XUÂN SON|XUÂN SON",
                "9|NGUYỄN TIẾN LINH|TIẾN LINH"
            ],
            subs: [
                "23|TRẦN TRUNG KIÊN|TRUNG KIÊN",
                "6|NGUYỄN VĂN VĨ|VĂN VĨ",
                "11|PHẠM TUẤN HẢI|TUẤN HẢI",
                "16|KHUẤT VĂN KHANG|VĂN KHANG",
                "21|LÊ PHẠM THÀNH LONG|THÀNH LONG",
                "5|PHAN TUẤN TÀI|TUẤN TÀI"
            ]
        },
        away: {
            formation: "4-2-3-1",
            coach: "PETER CKLAMOVSKI",
            players: [
                "1|SYIHAN HAZMI|HAZMI",
                "2|MATTHEW DAVIES|DAVIES",
                "4|DION COOLS|COOLS",
                "15|FERGUS TIERNEY|TIERNEY",
                "3|SHAHRUL SAAD|SHAHRUL",
                "6|BRENDAN GAN|GAN",
                "8|STUART WILKIN|WILKIN",
                "7|ARIF AIMAN|ARIF",
                "10|PAULO JOSUÉ|JOSUÉ",
                "11|FAISAL HALIM|FAISAL",
                "9|SAFAWI RASID|SAFAWI"
            ],
            subs: [
                "21|AZRI GHANI|AZRI",
                "12|LA'VEN HAU|LA'VEN",
                "14|ROMEL MORALES|MORALES",
                "13|NOOA LAINE|LAINE",
                "19|CORBIN-ONG|CORBIN"
            ]
        }
    },

    /* ---------------- ĐẾM NGƯỢC TRƯỚC TRẬN ---------------- */
    countdown: {
        title: "TRẬN ĐẤU SẮP BẮT ĐẦU",
        sub: "ĐĂNG KÝ KÊNH & BẬT CHUÔNG ĐỂ KHÔNG BỎ LỠ"
    },

    /* ---------------- ĐỘI BÓNG ----------------
     * logo: đường dẫn PNG/SVG/JPG (tương đối với index.html) hoặc URL.
     * color: màu chủ đạo (vạch màu dưới scoreboard, popup).            */
    homeTeam: {
        name: "ĐT VIỆT NAM",
        short: "VIỆT NAM",
        logo: "./assets/vietnam.svg",
        color: "#da251d"
    },

    awayTeam: {
        name: "ĐT MALAYSIA",
        short: "MALAYSIA",
        logo: "./assets/malaysia.svg",
        color: "#f5c400"
    },

    score: {
        home: 0,
        away: 0
    },

    /* period: "1H" | "HT" | "2H" | "ET1" | "ET2" | "FT" | "PEN"          */
    match: {
        minute: 34,
        second: 15,
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
        logo: "./assets/logo.svg",   // để "" nếu chỉ muốn hiện chữ
        title: "KÊNH THỂ THAO 24H",  // hiện khi không có logo
        line1: "HƠN 500K",
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
     * speed: pixel / giây (40 = chậm, 90 = vừa, 160 = nhanh)
     * direction: "left" (phải → trái) | "right"
     * messages: chuỗi, "TAG|nội dung", hoặc { tag, text }
     * TAG hỗ trợ: LIVE, BREAKING, NEWS, FULL TIME, TRANSFER, UPDATE      */
    ticker: {
        enabled: true,
        speed: 90,
        direction: "left",
        autoGoalNews: true,          // tự thêm tin khi có bàn thắng
        messages: [
            { tag: "BREAKING", text: "VIỆT NAM ĐANG KIỂM SOÁT THẾ TRẬN" },
            { tag: "LIVE", text: "MALAYSIA PHẢN CÔNG NGUY HIỂM" },
            { tag: "UPDATE", text: "CẬP NHẬT TỶ SỐ TRỰC TIẾP MỖI PHÚT" },
            { tag: "NEWS", text: "AFF CUP 2026 — VÒNG BẢNG LƯỢT TRẬN THỨ 3" },
            { tag: "TRANSFER", text: "CLB HÀ NỘI CHÍNH THỨC CHIÊU MỘ TIỀN ĐẠO MỚI" },
            "KÊNH THỂ THAO 24H — ĐĂNG KÝ KÊNH ĐỂ XEM TRỰC TIẾP MỌI TRẬN ĐẤU"
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
            "Việt Nam cố lên! 🇻🇳", "VN cố lên hãy đá vì màu cờ sắc áo", "hello mọi người",
            "Pha bóng vừa rồi tiếc quá!", "Thủ môn bắt hay quá", "Trọng tài thổi kỳ vậy",
            "Hôm nay đá hay ghê", "Tấn công biên phải đi anh em ơi", "GOOOOOAL sắp tới rồi",
            "Xem từ Đà Nẵng nè", "Malaysia chơi rát quá", "Ai dự đoán tỷ số đi",
            "2-1 cho Việt Nam nhé", "Hàng thủ chắc chắn ghê", "Bình luận viên nhiệt quá 🔥"
        ]
    },

    /* ---------------- LOWER THIRD -------------------------------------- */
    lowerThird: {
        duration: 5000,    // ms tự ẩn. 0 = giữ đến khi bấm Hide
        default: { name: "NGUYỄN VĂN A", role: "FORWARD", team: "VIỆT NAM" }
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
        goalPlayer: { home: "NGUYỄN VĂN A", away: "SAFAWI RASID" },
        cardPlayer: "PLAYER NAME",
        subOut: "PLAYER A",
        subIn: "PLAYER B"
    },

    /* ---------------- DEMO MODE ---------------------------------------
     * autoStart: tự chạy demo khi mở index.html lần đầu.
     * Khi livestream thật: tắt DEMO trong control panel (được ghi nhớ),
     * hoặc dùng URL index.html?demo=0                                    */
    demo: {
        autoStart: true,
        players: {
            home: ["NGUYỄN TIẾN LINH", "NGUYỄN QUANG HẢI", "NGUYỄN HOÀNG ĐỨC", "PHẠM TUẤN HẢI"],
            away: ["SAFAWI RASID", "ARIF AIMAN", "FAISAL HALIM", "DION COOLS"]
        },
        commentator: { name: "NEXT FOOTBALL", role: "BÌNH LUẬN VIÊN", team: "KÊNH THỂ THAO 24H" }
    }
};
