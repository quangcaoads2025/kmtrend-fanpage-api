import express from "express";
import fetch from "node-fetch";
import { MongoClient } from "mongodb";

const app = express();
app.use(express.json());

// ======================
// ENV
// ======================
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const MONGO_URI = process.env.MONGO_URI;

// MAP PAGE ID → PAGE TOKEN
const PAGE_TOKENS = {
  "908190325706631": process.env.PAGE_TOKEN_908190325706631,
  "10290275494336": process.env.PAGE_TOKEN_10290275494336,
};

// ======================
// CONNECT MONGODB
// ======================
const client = new MongoClient(MONGO_URI);
let messagesCol;

async function connectDB() {
  try {
    await client.connect();
    const db = client.db("inbox");
    messagesCol = db.collection("messages");
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection failed", err);
  }
}
connectDB();

// ======================
// VERIFY WEBHOOK
// ======================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
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

  try {
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
  } catch (err) {
    console.error("❌ Send message error:", err);
  }
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

  if (text && messagesCol) {
    // LƯU TIN NHẮN VÀO DB
    await messagesCol.insertOne({
      pageId,
      senderId,
      text,
      direction: "in",
      createdAt: new Date(),
    });

    // TRẢ LỜI
    const reply = `🤖 Bot nhận được: ${text}`;
    await sendMessage(pageId, senderId, reply);

    // LƯU TIN NHẮN BOT
    await messagesCol.insertOne({
      pageId,
      senderId,
      text: reply,
      direction: "out",
      createdAt: new Date(),
    });
  }

  res.sendStatus(200);
});

// ======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
