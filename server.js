
/**
 * KMtrend Fanpage - Production-Ready Backend Server
 * File: server.js
 */

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors'); // Thêm CORS
const { Pool } = require('pg');
require('dotenv').config();

const app = express();

// 1. Middleware
app.use(cors()); // Cho phép Frontend truy cập API
app.use(bodyParser.json());

// 2. Cấu hình Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'KMTREND_SECRET_TOKEN';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// 3. Khởi tạo Database
const initDB = async () => {
  const queryText = `
    CREATE TABLE IF NOT EXISTS customers (
      psid TEXT PRIMARY KEY,
      name TEXT,
      platform TEXT DEFAULT 'facebook',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      sender_psid TEXT,
      content TEXT,
      is_mine BOOLEAN DEFAULT FALSE,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      platform TEXT DEFAULT 'facebook'
    );
  `;
  try {
    await pool.query(queryText);
    console.log('✅ Database Initialized');
  } catch (err) {
    console.error('❌ DB Init Error:', err);
  }
};
initDB();

// 4. Routes
app.get('/', (req, res) => res.send('KMtrend API is running...'));

// Facebook Webhook Verification
app.get('/webhook', (req, res) => {
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Nhận tin nhắn từ Facebook
app.post('/webhook', async (req, res) => {
  let body = req.body;
  if (body.object === 'page') {
    for (let entry of body.entry) {
      if (entry.messaging) {
        let webhook_event = entry.messaging[0];
        let sender_psid = webhook_event.sender.id;
        if (webhook_event.message && webhook_event.message.text) {
          await handleIncomingMessage(sender_psid, webhook_event.message.text);
        }
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// API lấy lịch sử chat cho Frontend
app.get('/api/history/:psid', async (req, res) => {
  try {
    const { psid } = req.params;
    const result = await pool.query(
      'SELECT * FROM messages WHERE sender_psid = $1 ORDER BY timestamp ASC',
      [psid]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API lấy danh sách khách hàng CRM
app.get('/api/customers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customers ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper Functions
async function handleIncomingMessage(sender_psid, text) {
  try {
    await pool.query('INSERT INTO messages (sender_psid, content, is_mine) VALUES ($1, $2, $3)', [sender_psid, text, false]);
    await pool.query('INSERT INTO customers (psid) VALUES ($1) ON CONFLICT (psid) DO NOTHING', [sender_psid]);
    
    // AI Auto-Reply Placeholder
    const aiReply = "Chào bạn! Shop đã nhận được tin nhắn. Chúng mình sẽ phản hồi ngay.";
    await callSendAPI(sender_psid, aiReply);
    await pool.query('INSERT INTO messages (sender_psid, content, is_mine) VALUES ($1, $2, $3)', [sender_psid, aiReply, true]);
  } catch (err) {
    console.error('Handle Msg Error:', err);
  }
}

async function callSendAPI(sender_psid, text) {
  try {
    await axios.post(`https://graph.facebook.com/v12.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      recipient: { id: sender_psid },
      message: { text }
    });
  } catch (err) {
    console.error('Send API Error');
  }
}

app.listen(PORT, () => console.log(`🚀 Server ready on port ${PORT}`));
