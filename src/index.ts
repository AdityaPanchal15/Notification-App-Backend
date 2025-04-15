import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { WebSocketServer } from "ws";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Create WebSocket server
const wss = new WebSocketServer({ port: 8086 });

const sockets: Set<any> = new Set();

wss.on("connection", (ws) => {
  console.log("🔌 WebSocket client connected");
  sockets.add(ws);

  ws.on("close", () => {
    console.log("❌ WebSocket client disconnected");
    sockets.delete(ws);
  });
});

// Send notification to all connected clients
app.post("/send-notification", (req: any, res: any) => {
  const { title, body, app } = req.body;
  const message = JSON.stringify({ title, body, app });
  console.log('message: ', message);

  sockets.forEach((ws) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  });

  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 HTTP server running at http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server running at ws://localhost:8086`);
});
