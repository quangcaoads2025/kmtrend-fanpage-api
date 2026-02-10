import { MongoClient } from "mongodb";

const MONGO_URI = process.env.MONGO_URI;
const client = new MongoClient(MONGO_URI);

await client.connect();
const db = client.db("inbox");
const messagesCol = db.collection("messages");

console.log("✅ MongoDB connected");

import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ======================
// ENV
// ======================
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// MAP PAGE ID → PAGE TOKEN
const PAGE_TOKENS = {
  "908190325706631": process.env.PAGE_TOKEN_908190325706631,
  "10290275494336": process.env.PAGE_TOKEN_10290275494336,
};

// ======================
// VERIFY WEBHOOK
// ======================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// ======================
// SEND MESSAGE
// ======================
async function sendMessage(pageId, psid, text) {
  const pageToken = PAGE_TOKENS[pageId];
  if (!pageToken) {
    console.log("❌ No PAGE_TOKEN for page:", pageId);
    return;
  }

  await fetch(
    `https://graph.facebook.com/v18.0/me/messages?access_token=${pageToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: psid },
        message: { text },
      }),
    }
  );
}

// ======================
// RECEIVE EVENTS
// ======================
app.post("/webhook", async (req, res) => {
  const entry = req.body.entry?.[0];
  const event = entry?.messaging?.[0];

  if (!event) return res.sendStatus(200);

  const pageId = entry.id;
  const senderId = event.sender.id;
  const text = event.message?.text;

  console.log("📩 MESSAGE:", text);

  if (text) {
    await sendMessage(pageId, senderId, `🤖 Bot nhận được: ${text}`);
  }

  res.sendStatus(200);
});

// ======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
