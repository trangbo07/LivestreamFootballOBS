# ⚽ Football Overlay cho OBS

Overlay livestream bóng đá phong cách truyền hình: scoreboard, đồng hồ trận đấu, LIVE badge, ngày tháng, ticker chạy chữ, chat, popup (GOAL / thẻ vàng / thẻ đỏ / thay người / bắt đầu / nghỉ giữa hiệp / kết thúc), lower third, logo kênh, popup ủng hộ (QR), popup Follow us, control panel, phím tắt và DEMO MODE.

HTML/CSS/JS thuần, **không cần cài thư viện**. Server chỉ cần Node.js (≥ 16).

```
football-overlay/
├── index.html          ← overlay (đưa vào OBS)
├── control.html        ← bảng điều khiển
├── server.js           ← server đồng bộ (không cần npm install)
├── start.bat           ← nhấp đúp để chạy server (Windows)
├── css/  overlay · scoreboard · popup · ticker · chat · control
├── js/   config · bus · overlay · scoreboard · popup · ticker · chat · control
└── assets/ logo.svg · vietnam.svg · malaysia.svg
```

---

## 1. Chạy project

**Cách khuyên dùng (có server — bắt buộc nếu điều khiển OBS từ Chrome/điện thoại):**

- Nhấp đúp `start.bat`, **hoặc** mở PowerShell:
  ```powershell
  cd C:\Users\asus\Desktop\OBS_CONTROLLER\football-overlay
  node server.js
  ```
- Server in ra:
  ```
  Overlay (OBS):   http://localhost:3000/
  Control panel:   http://localhost:3000/control.html
  ```
- Đổi cổng: `$env:PORT=4000; node server.js`

> Vì sao cần server? OBS Browser Source chạy một trình duyệt riêng, **không dùng chung bộ nhớ với Chrome**. Server chuyển lệnh giữa control panel và overlay (SSE).

**Xem thử nhanh không cần server:** mở thẳng `index.html` bằng Chrome. Control panel mở trong *cùng trình duyệt* vẫn điều khiển được (BroadcastChannel), nhưng không điều khiển được overlay nằm trong OBS.

## 2. Mở control panel

- Trình duyệt: `http://localhost:3000/control.html`
- Điện thoại / máy khác cùng mạng: dùng địa chỉ IP server in ra (`http://192.168.x.x:3000/control.html`). Có thể cần cho phép Node.js trong Windows Firewall.
- **Dock ngay trong OBS (tiện nhất):** OBS → *Docks → Custom Browser Docks…* → Name: `Control`, URL: `http://localhost:3000/control.html` → Apply. Phím tắt hoạt động khi bấm vào dock.

Góc trên control panel hiện: `SERVER: ĐÃ KẾT NỐI` + `OVERLAY: ONLINE` là đã thông.

## 3. Thêm Browser Source vào OBS

1. Trong Scene: **Sources → + → Browser**, đặt tên `Football Overlay`.
2. **Bỏ tick** *Local file*.
3. URL: `http://localhost:3000/?demo=0`
   (`?demo=0` = tắt demo khi lên sóng thật; bỏ đi nếu muốn xem demo.)
4. Đặt source này **trên cùng** danh sách Sources (nằm trên video trận đấu).

## 4. Set 1920×1080

Trong hộp thoại Browser Source:

| Mục | Giá trị |
|---|---|
| Width | `1920` |
| Height | `1080` |
| Use custom frame rate | ✔, `60` |
| Custom CSS | *(để trống hoặc giữ mặc định)* |
| Shutdown source when not visible | ✘ (tắt, để đồng hồ & state giữ nguyên) |
| Refresh browser when scene becomes active | ✘ |

Canvas OBS nên là 1920×1080 (*Settings → Video → Base Canvas*). Nếu canvas khác, chuột phải source → *Transform → Fit to screen*.

## 5. Nền trong suốt

Overlay đã đặt `background: transparent` cho `html, body`, không margin, không scrollbar, nên mặc định đã trong suốt. Cần kiểm tra:
- Custom CSS của source **không** chứa `background-color` khác `rgba(0,0,0,0)` (mặc định OBS là `body { background-color: rgba(0, 0, 0, 0); ... }` — giữ nguyên).
- Nền xanh sân bóng + thanh nút chỉ hiện khi mở bằng **trình duyệt thường** (để preview). Trong OBS tự ẩn (phát hiện `window.obsstudio`). Thêm `&clean=1` vào URL nếu muốn ẩn ở mọi nơi.
- Khung viền xanh navy quanh màn hình là thiết kế (giống ảnh tham khảo) — tắt bằng nút *Khung viền* hoặc `frame.enabled: false` trong config.

## 6. Điều khiển khi đang livestream

| Việc | Control panel | Phím tắt |
|---|---|---|
| Chạy / dừng đồng hồ | ▶ Start / ❚❚ Pause | `Space` |
| Chỉnh giờ | ô mm:ss → *Set giờ*, nút ±10s / ±1' | |
| Đổi hiệp | Hiệp 1 · HT · Hiệp 2 · ET1 · ET2 · FT · PEN | |
| Bù giờ (+4') | ô *Bù giờ* → Set | |
| Tỷ số | nút − / + từng đội, hoặc nhập rồi *Set* | |
| Bàn thắng (tự +1 tỷ số, popup, flash scoreboard, tin ticker) | chọn đội + tên cầu thủ → **⚽ GOAL** | `G` (`Shift+G` = đội khách) |
| Thẻ vàng / đỏ | 🟨 / 🟥 | `Y` / `R` |
| Thay người | OUT / IN → 🔄 | `S` |
| Bắt đầu / Nghỉ / Kết thúc | MATCH START · HALF TIME · FULL TIME | `H` · `F` |
| Ẩn popup đang hiện | *Ẩn popup hiện tại* | `Esc` |
| Ticker | sửa nội dung → *Áp dụng*; *Đẩy tin* = tin nóng lên đầu; tốc độ; chiều | `T` |
| Chat | username + bình luận → Gửi (Enter); Fake chat; Xoá | `C` |
| Lower third | Tên / vai trò / đội → Show | `L` |
| Ủng hộ (QR) | điền ngân hàng / STK → Show | `D` |
| Follow us | 🔔 Follow us | |
| LIVE · Scoreboard · Ngày · Khung | các nút bật/tắt ở mục *Hiển thị* | |
| Demo | nút **DEMO MODE** trên cùng (được ghi nhớ) | |

Phím tắt chạy khi control panel đang được focus (không gõ trong ô nhập). Trong OBS, chuột phải source → *Interact* cũng dùng được phím tắt trực tiếp trên overlay.

Popup được **xếp hàng**: bấm GOAL rồi thẻ vàng liên tiếp thì chúng hiện lần lượt, không đè nhau.

Trạng thái (tỷ số, giờ, hiệp, logo…) được lưu lại: refresh OBS không mất tỷ số, đồng hồ vẫn chạy đúng.

---

## Tính năng mới (v2)

| Tính năng | Cách dùng |
|---|---|
| **4 theme màu** (Neon Night, Premier, Gold, Classic) | Control → *Giao diện*, hoặc `theme` trong config |
| **Chat YouTube thật** | Control → *YouTube Live Chat* → dán link live / `@kênh` → *Kết nối chat*. Không cần API key. Có avatar, emoji, huy hiệu chủ kênh/mod/hội viên, Super Chat |
| **Lọc từ cấm** | `chat.bannedWords` + `chat.filterMode` (`mask` / `hide`) |
| **Đội hình ra sân** | Control → *Đội hình* (cả 2 đội / từng đội), phím `U` |
| **Chế độ phân tích** (camera nhỏ + heatmap + thống kê) | Control → *Phân tích & thống kê*, phím `A` |
| **Heatmap** | Chạm/kéo lên sân trong control để ghi vị trí bóng, hoặc *Mô phỏng dữ liệu* |
| **Kiểm soát bóng tự tính** | Bấm đội đang giữ bóng (phím `1` / `2`, `0` dừng) — chỉ tính khi đồng hồ chạy |
| **Thống kê** (sút, phạt góc, phạm lỗi, thẻ…) | Nút +/− trong control; thẻ & bàn thắng tự cộng. Popup thống kê: phím `K` |
| **Đếm ngược trước trận** | Control → *Đếm ngược* |
| **Thu nhỏ camera thật trong OBS** | OBS 28+: *Tools → WebSocket Server Settings → Enable*. Control → *Thu nhỏ camera trong OBS* → nhập tên source camera → Kết nối. Khi bật chế độ phân tích, camera trượt vào khung nhỏ và trả lại khi tắt. Không kết nối thì overlay chỉ che phần ngoài khung |

### 2 camera (cam cận + cam toàn cảnh)

1. Trong OBS, ở **cùng 1 scene**, thêm 2 source camera (vd. đặt tên `Cam can` và `Cam toan canh`) và source overlay (Browser). **Overlay phải nằm trên cùng** danh sách Sources.
2. OBS → *Tools → WebSocket Server Settings* → tick **Enable WebSocket server** (cổng 4455, ghi lại mật khẩu nếu có).
3. Control → **Kết nối OBS**: nhập mật khẩu + đúng tên 2 source → *Kết nối OBS*.
4. Control → **Camera & chuyển cảnh**:
   - `Q` cam cận · `W` toàn cảnh · `E` PiP (toàn cảnh + cam cận nhỏ ở góc) · `Shift+E` PiP đảo · `Z` chia đôi.
   - **Tự động chuyển cam**: hiện đội hình → toàn cảnh (ẩn đội hình thì quay lại); bàn thắng → cam cận vài giây rồi quay lại; bắt đầu / nghỉ / hết trận → cam tuỳ chọn.
   - Bấm cam bằng tay khi đang tự chuyển thì huỷ lượt tự quay lại.
   - Nút scene: chuyển scene OBS ngay trong control.
5. Chế độ phân tích (`A`) thu nhỏ đúng cam đang phát vào khung.
6. **Hoặc đổi scene cùng lúc với chế độ phân tích:** ở mục *Chế độ phân tích (heatmap) → đổi scene*, chọn scene sẽ chuyển sang khi BẬT (vd. Scene 2) và scene quay về khi TẮT (để trống = về scene trước đó). Khi chọn scene, camera không bị thu nhỏ nữa — bạn tự bố trí camera trong scene 2. Nhớ **thêm source overlay vào cả scene 2** (Add → Browser → *Add Existing* chọn đúng source overlay).

Có thể đặt sẵn trong `config.js` → `obs` (bật `enabled: true` để tự kết nối) và `cameras` (tên source, bố cục ban đầu, quy tắc tự chuyển, vị trí khung PiP / chia đôi).

> Chat YouTube dùng cách đọc giống cửa sổ live chat của trình duyệt (không chính thức). Nếu YouTube thay đổi và ngừng hoạt động, điền `youtube.apiKey` (YouTube Data API v3) để dùng API chính thức.

---

## Cấu hình — `js/config.js`

Mọi dữ liệu nằm ở đây: tên đội, logo, màu, tỷ số, giờ, nhãn hiệp, ticker, chat (fake / WebSocket), lower third, thời gian popup, thông tin ủng hộ, mạng xã hội, demo.

- Thay logo: bỏ PNG vào `assets/` và sửa `logo: "./assets/ten-file.png"`, hoặc upload trong control panel.
- QR: để `qrImage: ""` thì tự tạo QR qua VietQR từ `bankId + accountNo + content` (cần internet). Hoặc chỉ định ảnh QR của bạn.
- **Sửa config.js thì state đã lưu sẽ được reset về config** (để thay đổi luôn có hiệu lực). Refresh source trong OBS sau khi sửa.
- Font Oswald / Roboto Condensed tải từ Google Fonts. Nếu máy không có mạng sẽ dùng font dự phòng.

## JavaScript API

Gọi trong console của overlay, hoặc từ bất kỳ đâu qua HTTP:

```js
Overlay.setScore(1, 0);
Overlay.setTime(45, 32);
Overlay.startClock();  Overlay.pauseClock();  Overlay.resetClock();
Overlay.setPeriod("2H");          // 1H | HT | 2H | ET1 | ET2 | FT | PEN
Overlay.setAddedTime(4);
Overlay.goal({ team: "home", player: "NGUYEN VAN A" });
Overlay.yellowCard({ player: "PLAYER NAME", team: "away" });
Overlay.redCard({ player: "PLAYER NAME" });
Overlay.substitution({ out: "PLAYER A", in: "PLAYER B", team: "home" });
Overlay.showTicker("BREAKING NEWS...");
Overlay.setTicker(["BREAKING|Tin 1", "NEWS|Tin 2"]);
Overlay.showLowerThird({ name: "PLAYER NAME", role: "MIDFIELDER", team: "VIETNAM" });
Overlay.showPopup("FULL_TIME");   // GOAL | YELLOW_CARD | RED_CARD | SUBSTITUTION | MATCH_START | HALF_TIME | FULL_TIME | CUSTOM
Overlay.chat("username", "Việt Nam cố lên!");
Overlay.showDonation();  Overlay.showSocial();
Overlay.setTeams({ home: { name: "ĐT THÁI LAN", logo: "./assets/thailand.png" } });
Overlay.setDemo(false);
```

Qua HTTP (Stream Deck, bot, phần mềm live score…):

```powershell
curl.exe -X POST http://localhost:3000/api/cmd -H "Content-Type: application/json" -d '{\"fn\":\"goal\",\"args\":[{\"team\":\"home\",\"player\":\"NGUYEN VAN A\"}]}'
```

`GET /api/state` trả về trạng thái hiện tại (JSON).

**Chat thật:** đặt `chat.websocketUrl` trong config. Server WebSocket gửi `{"user":"abc","text":"hello"}` (hoặc mảng) là tin hiện lên khung chat. Hoặc POST `{"fn":"chat","args":[{"user":"abc","text":"hello"}]}` vào `/api/cmd`.

## Hiệu năng OBS

- Animation chỉ dùng `transform` + `opacity`; ticker chạy bằng Web Animations API trên compositor.
- Không dùng `filter: blur`/`backdrop-filter`; glow được làm bằng cách animate opacity của lớp shadow tĩnh.
- Đồng hồ cập nhật DOM tối đa 1 lần/giây; tên đội chỉ đo lại khi thay đổi.
