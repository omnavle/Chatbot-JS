import express from "express";
import cors from "cors";
import "dotenv/config";
import { app as graphApp } from "./graph.js";
import { sequelize, connectDB } from "./db.js";
import ChatSession from "./models/ChatSession.js";
import ChatMessage from "./models/ChatMessage.js";

const server = express();

server.use(cors());
server.use(express.json());

// ---------- GET all sessions (for sidebar history) ----------
server.get("/sessions", async (req, res) => {
    try {
        const sessions = await ChatSession.findAll({
            order: [["created_at", "DESC"]],
        });
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------- CREATE a new empty session ----------
server.post("/sessions", async (req, res) => {
    try {
        const session = await ChatSession.create({ title: "New Chat" });
        res.json(session);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------- GET all messages of a session ----------
server.get("/sessions/:id/messages", async (req, res) => {
    try {
        const { id } = req.params;

        const session = await ChatSession.findByPk(id);
        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        const messages = await ChatMessage.findAll({
            where: { session_id: id },
            order: [["created_at", "ASC"]],
        });

        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------- DELETE a session ----------
server.delete("/sessions/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const session = await ChatSession.findByPk(id);
        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        await session.destroy(); // cascades to messages
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------- MAIN CHAT ROUTE ----------
server.post("/chat", async (req, res) => {
    try {
        const { message, session_id } = req.body;

        let session;

        if (session_id) {
            session = await ChatSession.findByPk(session_id);
            if (!session) {
                return res.status(404).json({ error: "Session not found" });
            }
        } else {
            session = await ChatSession.create({
                title: message.slice(0, 40),
            });
        }

        // Save user message
        await ChatMessage.create({
            session_id: session.id,
            role: "user",
            content: message,
        });

        // Load full history for context
        const history = await ChatMessage.findAll({
            where: { session_id: session.id },
            order: [["created_at", "ASC"]],
        });

        const graphMessages = history.map((m) => ({
            role: m.role,
            content: m.content,
        }));

        // Invoke LangGraph
        const finalState = await graphApp.invoke(
            { messages: graphMessages },
            { configurable: { thread_id: String(session.id) } }
        );

        const lastMessage = finalState.messages[finalState.messages.length - 1];
        const replyText = lastMessage.content;

        // Save assistant reply
        await ChatMessage.create({
            session_id: session.id,
            role: "assistant",
            content: replyText,
        });

        res.json({
            reply: replyText,
            session_id: session.id,
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: err.message });
    }
});

// ---------- START SERVER ----------
const PORT = process.env.PORT || 5000;

async function start() {
    await connectDB();
    await sequelize.sync(); // auto-creates tables if they don't exist
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

start();