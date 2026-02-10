import express from "express";

const app = express();
app.use(express.json());

// ✅ LẤY TOKEN TỪ ENV (Render)
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// ======================
// VERIFY WEBHOOK (META)
// ======================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  }

  console.log("❌ Webhook verify failed", { mode, token });
  return res.sendStatus(403);
});

// ======================
// RECEIVE EVENTS
// ======================
app.post("/webhook", (req, res) => {
  console.log("📩 EVENT FROM META:");
  console.log(JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
