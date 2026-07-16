import express from "express";
import cors from "cors";
import "dotenv/config";
import { Op } from "sequelize";
import { app as graphApp } from "./index.js";
import { sequelize, connectDB } from "./db.js";
import ChatSession from "./models/ChatSession.js";
import ChatMessage from "./models/ChatMessage.js";

const server = express();

server.use(cors());
server.use(express.json());

// ---------- GET all sessions ----------
server.get("/sessions", async (req, res) => {
    try {
        const sessions = await ChatSession.findAll({ order: [["created_at", "DESC"]] });
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

// ---------- RENAME a session ----------
server.patch("/sessions/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { title } = req.body;

        const session = await ChatSession.findByPk(id);
        if (!session) return res.status(404).json({ error: "Session not found" });

        if (!title || !title.trim()) {
            return res.status(400).json({ error: "Title cannot be empty" });
        }

        session.title = title.trim();
        await session.save();

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
        if (!session) return res.status(404).json({ error: "Session not found" });

        const messages = await ChatMessage.findAll({
            where: { session_id: id },
            order: [["created_at", "ASC"]],
        });

        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------- EDIT a message + regenerate everything after it ----------
server.put("/sessions/:sessionId/messages/:messageId", async (req, res) => {
    try {
        const { sessionId, messageId } = req.params;
        const { content } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ error: "Message cannot be empty" });
        }

        const session = await ChatSession.findByPk(sessionId);
        if (!session) return res.status(404).json({ error: "Session not found" });

        const message = await ChatMessage.findOne({
            where: { id: messageId, session_id: sessionId },
        });

        if (!message || message.role !== "user") {
            return res.status(404).json({ error: "Editable message not found" });
        }

        // update the edited message itself
        message.content = content;
        await message.save();

        // remove every message that came after it (old bot reply, later turns)
        await ChatMessage.destroy({
            where: {
                session_id: sessionId,
                id: { [Op.gt]: message.id },
            },
        });

        // rebuild conversation history up to and including the edited message
        const history = await ChatMessage.findAll({
            where: { session_id: sessionId },
            order: [["id", "ASC"]],
        });

        const graphMessages = history.map((m) => ({ role: m.role, content: m.content }));

        const finalState = await graphApp.invoke(
            { messages: graphMessages },
            { configurable: { thread_id: String(sessionId) } }
        );

        const lastMessage = finalState.messages[finalState.messages.length - 1];
        const replyText = lastMessage.content;

        const botMsg = await ChatMessage.create({
            session_id: sessionId,
            role: "assistant",
            content: replyText,
        });

        res.json({
            reply: replyText,
            bot_message_id: botMsg.id,
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: err.message });
    }
});

// ---------- DELETE a session ----------
server.delete("/sessions/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const session = await ChatSession.findByPk(id);
        if (!session) return res.status(404).json({ error: "Session not found" });

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
            if (!session) return res.status(404).json({ error: "Session not found" });
        } else {
            session = await ChatSession.create({ title: message.slice(0, 40) });
        }

        const userMsg = await ChatMessage.create({
            session_id: session.id,
            role: "user",
            content: message,
        });

        const history = await ChatMessage.findAll({
            where: { session_id: session.id },
            order: [["id", "ASC"]],
        });

        const graphMessages = history.map((m) => ({ role: m.role, content: m.content }));

        const finalState = await graphApp.invoke(
            { messages: graphMessages },
            { configurable: { thread_id: String(session.id) } }
        );

        const lastMessage = finalState.messages[finalState.messages.length - 1];
        const replyText = lastMessage.content;

        const botMsg = await ChatMessage.create({
            session_id: session.id,
            role: "assistant",
            content: replyText,
        });

        res.json({
            reply: replyText,
            session_id: session.id,
            user_message_id: userMsg.id,
            bot_message_id: botMsg.id,
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
    await sequelize.sync();
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

start();