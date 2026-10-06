const http = require("http");
const fs = require("fs");
const path = require("path");

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || 8080);
const ROOT = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

const defaultScore = {
  teamA: "Đội A",
  scoreA: 0,
  logoA: "",
  /** Màu áo đội A — hex / rgb / tên (hiện vạch dưới overlay tỉ số) */
  kitColorA: "",
  teamB: "Đội B",
  scoreB: 0,
  logoB: "",
  kitColorB: "",
  period: "H1",
  clockSeconds: 0,
  clockRunning: false,
  /** Khi clockRunning: mốc thời gian thật (ms) và giây tại mốc đó — để đồng hồ chạy khi không còn tab controller */
  clockAnchorMs: null,
  clockAnchorBaseSeconds: null,
  addedMinutes: 0,
  eventText: "",
  eventUntil: 0,
  /** none | goal | yellow | red | sub | custom */
  eventType: "none",
  /** "" | A | B */
  eventSide: "",
  /** Thay người — cầu thủ rời sân / vào sân (overlay hiển thị OUT / IN) */
  subOut: "",
  subIn: "",
  cornersA: 0,
  cornersB: 0,
  shotsA: 0,
  shotsB: 0,
  yellowA: 0,
  yellowB: 0,
  redA: 0,
  redB: 0,
  lineupA: "",
  lineupB: "",
  coachA: "",
  coachB: "",
  /** off | A | B | both — chỉ overlay đội hình đọc */
  lineupShow: "off",
  /** full | clock | hidden — overlay bảng tỉ số (clock = chỉ hiện giờ) */
  scoreboardView: "full",
  /** off | midbreak | officials | var */
  infoPanelMode: "off",
  midbreakTitle: "NGHI GIUA HIEP",
  midbreakLine: "",
  /** Intro overlay (trước trận) */
  introShow: "off",
  introStage: "CHUNG KET",
  introTournament: "GIAI BONG DA",
  introDate: "",
  introTime: "",
  introVenue: "",
  introTagline: "",
  /** Overlay VAR — tiêu đề (Penalty / Phạm lỗi…) và dòng phụ */
  varTitle: "PENALTY",
  varDetail: "",
  scorersA: "",
  scorersB: "",
  refereeName: "",
  commentatorMain: "",
  commentatorGuest: "",
  updatedAt: new Date().toISOString()
};

let scoreData = { ...defaultScore };
const sseClients = new Set();

function injectLiveClockSeconds(data) {
  const out = { ...data };
  if (out.clockRunning && out.clockAnchorMs != null) {
    const base =
      out.clockAnchorBaseSeconds != null
        ? Number(out.clockAnchorBaseSeconds)
        : Number(out.clockSeconds) || 0;
    const delta = Math.floor((Date.now() - Number(out.clockAnchorMs)) / 1000);
    const n = base + delta;
    out.clockSeconds = n < 0 ? 0 : n > 9000 ? 9000 : n;
  }
  return out;
}

function sendJson(res, code, payload) {
  const text = JSON.stringify(payload);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(text);
}

function sanitizeScore(input) {
  const toInt = (value, min, max) => {
    const n = Number.parseInt(value, 10);
    if (Number.isNaN(n) || n < min) return min;
    if (n > max) return max;
    return n;
  };

  const toText = (value, fallback) => {
    const text = (value ?? "").toString().trim();
    return text || fallback;
  };

  const truncLineup = (value, max) => (value ?? "").toString().slice(0, max);
  const truncCoach = (value) => (value ?? "").toString().trim().slice(0, 120);
  const truncEvent = (value) => (value ?? "").toString().trim().slice(0, 220);
  const truncShort = (value, max) => (value ?? "").toString().trim().slice(0, max);

  const kitColor = (value) => {
    const raw = truncShort(value, 40);
    if (!raw) return "";
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(raw)) return raw;
    if (/^rgba?\(\s*[\d\s.%+,-]+\)$/i.test(raw)) return raw;
    if (/^hsla?\(\s*[\d\s.%+deg,-]+\)$/i.test(raw)) return raw;
    if (/^[a-z]{3,20}$/i.test(raw)) return raw.toLowerCase();
    return "";
  };

  const lineupShow = (() => {
    const s = (input.lineupShow ?? "").toString().trim().toLowerCase();
    if (s === "a" || s === "teama" || s === "team_a") return "A";
    if (s === "b" || s === "teamb" || s === "team_b") return "B";
    if (s === "both" || s === "ab" || s === "all" || s === "hai") return "both";
    return "off";
  })();

  const scoreboardView = (() => {
    const s = (input.scoreboardView ?? "").toString().trim().toLowerCase();
    if (s === "clock" || s === "time" || s === "clock_only" || s === "dongho") return "clock";
    if (s === "hidden" || s === "hide" || s === "off" || s === "an") return "hidden";
    return "full";
  })();

  const infoPanelMode = (() => {
    const s = (input.infoPanelMode ?? "").toString().trim().toLowerCase();
    if (s === "midbreak" || s === "break" || s === "half" || s === "ht") return "midbreak";
    if (s === "officials" || s === "ref" || s === "blv") return "officials";
    if (s === "var" || s === "varreview" || s === "video") return "var";
    return "off";
  })();

  const eventType = (() => {
    const s = (input.eventType ?? "").toString().trim().toLowerCase();
    if (s === "goal") return "goal";
    if (s === "yellow") return "yellow";
    if (s === "red") return "red";
    if (s === "sub" || s === "substitution" || s === "thaynguoi") return "sub";
    if (s === "custom") return "custom";
    return "none";
  })();

  const eventSide = (() => {
    const s = (input.eventSide ?? "").toString().trim().toUpperCase();
    if (s === "A" || s === "B") return s;
    return "";
  })();

  return {
    teamA: toText(input.teamA, "Đội A"),
    scoreA: toInt(input.scoreA, 0, 99),
    logoA: toText(input.logoA, ""),
    kitColorA: kitColor(input.kitColorA),
    teamB: toText(input.teamB, "Đội B"),
    scoreB: toInt(input.scoreB, 0, 99),
    logoB: toText(input.logoB, ""),
    kitColorB: kitColor(input.kitColorB),
    period: toText(input.period, "H1").toUpperCase(),
    clockSeconds: toInt(input.clockSeconds, 0, 9000),
    clockRunning: Boolean(input.clockRunning),
    addedMinutes: toInt(input.addedMinutes, 0, 30),
    eventText: truncEvent(input.eventText) || "",
    eventUntil: toInt(input.eventUntil, 0, 9999999999999),
    eventType,
    eventSide,
    subOut: truncShort(input.subOut || "", 80),
    subIn: truncShort(input.subIn || "", 80),
    cornersA: toInt(input.cornersA, 0, 50),
    cornersB: toInt(input.cornersB, 0, 50),
    shotsA: toInt(input.shotsA, 0, 99),
    shotsB: toInt(input.shotsB, 0, 99),
    yellowA: toInt(input.yellowA, 0, 20),
    yellowB: toInt(input.yellowB, 0, 20),
    redA: toInt(input.redA, 0, 10),
    redB: toInt(input.redB, 0, 10),
    lineupA: truncLineup(input.lineupA, 2500),
    lineupB: truncLineup(input.lineupB, 2500),
    coachA: truncCoach(input.coachA),
    coachB: truncCoach(input.coachB),
    lineupShow,
    scoreboardView,
    infoPanelMode,
    midbreakTitle: truncShort(input.midbreakTitle || "NGHI GIUA HIEP", 80) || "NGHI GIUA HIEP",
    midbreakLine: truncShort(input.midbreakLine || "", 120),
    introShow: truncShort(input.introShow || "off", 10).toLowerCase() === "on" ? "on" : "off",
    introStage: truncShort(input.introStage || "", 80),
    introTournament: truncShort(input.introTournament || "", 120),
    introDate: truncShort(input.introDate || "", 40),
    introTime: truncShort(input.introTime || "", 40),
    introVenue: truncShort(input.introVenue || "", 120),
    introTagline: truncShort(input.introTagline || "", 120),
    varTitle: truncShort(input.varTitle || "PENALTY", 80) || "PENALTY",
    varDetail: truncShort(input.varDetail || "", 120),
    scorersA: truncLineup(input.scorersA || "", 2500),
    scorersB: truncLineup(input.scorersB || "", 2500),
    refereeName: truncShort(input.refereeName || "", 120),
    commentatorMain: truncShort(input.commentatorMain || "", 120),
    commentatorGuest: truncShort(input.commentatorGuest || "", 120),
    updatedAt: new Date().toISOString()
  };
}

function safeResolve(filePath) {
  const normalized = path.normalize(filePath).replace(/^([.][.][/\\])+/, "");
  return path.join(ROOT, normalized);
}

function sendSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcastScore() {
  const payload = injectLiveClockSeconds(scoreData);
  for (const client of sseClients) {
    try {
      sendSse(client, payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }

  if (url.pathname === "/api/score" && req.method === "GET") {
    sendJson(res, 200, injectLiveClockSeconds(scoreData));
    return;
  }

  if (url.pathname === "/api/score" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        const prevLineupShow = scoreData.lineupShow;
        const prevScoreboardView = scoreData.scoreboardView || "full";
        const prevInfoPanelMode = scoreData.infoPanelMode || "off";
        const wasRunning = Boolean(scoreData.clockRunning);
        const next = sanitizeScore(parsed);
        const isRunning = Boolean(next.clockRunning);

        if (!isRunning) {
          next.clockAnchorMs = null;
          next.clockAnchorBaseSeconds = null;
        } else if (isRunning && !wasRunning) {
          next.clockAnchorMs = Date.now();
          next.clockAnchorBaseSeconds = next.clockSeconds;
        } else if (isRunning && wasRunning) {
          next.clockAnchorMs = Date.now();
          next.clockAnchorBaseSeconds = next.clockSeconds;
        }

        scoreData = next;
        if (!Object.prototype.hasOwnProperty.call(parsed, "lineupShow")) {
          scoreData.lineupShow = prevLineupShow;
        }
        if (!Object.prototype.hasOwnProperty.call(parsed, "scoreboardView")) {
          scoreData.scoreboardView = prevScoreboardView;
        }
        if (!Object.prototype.hasOwnProperty.call(parsed, "infoPanelMode")) {
          scoreData.infoPanelMode = prevInfoPanelMode;
        }
        broadcastScore();
        sendJson(res, 200, { ok: true, data: injectLiveClockSeconds(scoreData) });
      } catch {
        sendJson(res, 400, { ok: false, error: "Invalid JSON" });
      }
    });
    return;
  }

  if (url.pathname === "/api/score/stream" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*"
    });

    res.write("retry: 1000\n");
    sendSse(res, injectLiveClockSeconds(scoreData));
    sseClients.add(res);
    req.socket.setTimeout(0);

    req.on("close", () => {
      sseClients.delete(res);
      try {
        res.end();
      } catch {
        // Ignore close errors from disconnected clients.
      }
    });
    return;
  }

  const pathname = url.pathname === "/" ? "/controller.html" : url.pathname;
  const filePath = safeResolve(pathname);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`OBS controller server running at http://localhost:${PORT}`);
});

setInterval(() => {
  for (const client of sseClients) {
    try {
      client.write(": keepalive\n\n");
    } catch {
      sseClients.delete(client);
    }
  }
}, 15000);
