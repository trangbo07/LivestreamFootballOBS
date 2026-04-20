# OBS Score Overlay (OBS-Compatible Sync)

## Vi sao OBS khong update khi bam Update?

OBS Browser Source khong dung chung localStorage voi Chrome/Edge, nen neu ban mo controller o trinh duyet thuong va mo overlay trong OBS (Local file), du lieu se khong dong bo.

## Cach dung dung (khuyen nghi)

Su dung server noi bo trong thu muc project de ca controller va overlay doc/ghi cung mot API.

1. Mo PowerShell tai thu muc project va chay:
   ```powershell
   cd c:\Users\asus\Desktop\OBS_CONTROLLER
   node server.js
   ```
2. Mo controller trong trinh duyet:
   - `http://localhost:8080/controller.html`
3. Trong OBS, them 1 Browser Source duy nhat:
   - URL: `http://localhost:8080/overlay.html`
4. Cho source nay:
   - Width: 1920
   - Height: 1080
   - Shutdown source when not visible: OFF
   - Refresh browser when scene becomes active: ON

## Tinh nang hien co

- Dong bo OBS qua API `/api/score` (khong phu thuoc localStorage app khac).
- Realtime tuc thi qua SSE stream `/api/score/stream`.
- Controller auto-sync khi dang go (khong can bam Update).
- Van co fallback localStorage de test nhanh tren browser.
- Hieu ung Goal khi diem tang.
- Ho tro logo doi bong (URL).
- Nut swap doi, A +1, B +1, reset nhanh.
- Match clock theo giay: Start/Pause, +1:00, -1:00, reset.
- Chon trang thai tran: H1, HT, H2, FT, ET1, ET2, PEN.
- Event ticker: Goal, yellow card, red card, event custom.
- Live stats: corners, shots, yellow, red cho 2 doi.

## Kien truc tach file overlay

- `overlay.html`: Overlay all-in-one. Mac dinh chi hien thi scoreboard (ten doi, logo, ti so, thoi gian, hiep dau).
- Khi co su kien tu controller (goal/card/custom event), overlay tu hien hieu ung dep mat roi tu an.
- `overlay-stats.html` va `overlay-event.html` van co the dung neu ban muon setup nhieu lop rieng.

## Shortcut nhanh trong controller

- Space: Start/Pause clock
- G: Goal Team A
- H: Goal Team B

## Dieu khien tu dien thoai (cung Wi-Fi)

1. Tim IP may tinh (vi du `192.168.1.20`).
2. Khi server dang chay, mo:
   - Dien thoai: `http://192.168.1.20:8080/controller.html`
   - OBS: `http://192.168.1.20:8080/overlay.html`

## Ghi chu

- Neu mo file truc tiep (`file:///...`) thi chi local mode, OBS co the khong nhan update.
- De stop server: `Ctrl + C` trong terminal dang chay `node server.js`.
