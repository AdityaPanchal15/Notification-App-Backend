import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import admin from "firebase-admin";
import path from "path";
import { WebSocketServer } from "ws";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Load service account key
const serviceAccount = require(path.resolve("serviceAccountKey.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL // required for RTDB
});

// Create WebSocket server
const wss = new WebSocketServer({ port: 8080 });

const sockets: Set<any> = new Set();

wss.on("connection", (ws) => {
  console.log("🔌 WebSocket client connected");
  sockets.add(ws);

  ws.on("close", () => {
    console.log("❌ WebSocket client disconnected");
    sockets.delete(ws);
  });
});

// Realtime Database tokens path: /tokens/userId => token
async function getAllUserTokens(): Promise<string[]> {
  const snapshot = await admin.database().ref("tokens").once("value");
  const data = snapshot.val();
  return data ? Object.values(data) : [];
}

type SendNotificationRequest = {
  title: string;
  body: string;
  icon?: string;
};

// Send notification to all connected clients
app.post('/send-notification', (req, res) => {
  const { title, body } = req.body;
  const message = JSON.stringify({ title, body });

  sockets.forEach((ws) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  });

  res.json({ success: true });
});

// Send FCM notification to all users + broadcast via WebSocket
const handleSend = async (
  req: Request<any, any, SendNotificationRequest>,
  res: Response
) => {
  const { title, body, icon } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: "Missing title or body" });
  }

  try {
    const tokens = await getAllUserTokens();

    if (tokens.length === 0) {
      return res.status(200).json({ success: false, message: "No tokens found" });
    }

    // Send FCM messages
    const message = {
      notification: { title, body },
      tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    // Broadcast via WebSocket to all connected clients
    const payload = JSON.stringify({ title, body, icon });
    sockets.forEach((ws) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(payload);
      }
    });

    res.status(200).json({ success: true, response });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

app.post("/send", handleSend as express.RequestHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 HTTP server running at http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server running at ws://localhost:8080`);
});
