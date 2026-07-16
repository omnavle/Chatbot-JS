import { useState, useEffect, useRef } from "react";
import api from "../api";
import "./ChatBox.css";

function ChatBox() {
    const [sessions, setSessions] = useState([]);
    const [activeSession, setActiveSession] = useState(null);
    const [messages, setMessages] = useState([]);
    const [question, setQuestion] = useState("");
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef(null);

    useEffect(() => {
        loadSessions();
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    async function loadSessions() {
        const res = await api.get("/sessions");
        setSessions(res.data);
    }

    async function openSession(sessionId) {
        setActiveSession(sessionId);
        const res = await api.get(`/sessions/${sessionId}/messages`);
        setMessages(
            res.data.map((m) => ({
                sender: m.role === "user" ? "user" : "bot",
                text: m.content,
            }))
        );
    }

    function startNewChat() {
        setActiveSession(null);
        setMessages([]);
    }

    async function sendMessage() {
        if (!question.trim()) return;

        const userMessage = { sender: "user", text: question };
        setMessages((prev) => [...prev, userMessage]);

        const current = question;
        setQuestion("");
        setLoading(true);

        try {
            const res = await api.post("/chat", {
                session_id: activeSession,
                message: current,
            });

            const botMessage = { sender: "bot", text: res.data.reply };
            setMessages((prev) => [...prev, botMessage]);

            // if this was a brand new chat, we now have a session_id
            if (!activeSession) {
                setActiveSession(res.data.session_id);
                loadSessions();
            }
        } catch {
            setMessages((prev) => [
                ...prev,
                { sender: "bot", text: "Something went wrong." },
            ]);
        }

        setLoading(false);
    }

    async function deleteSession(e, sessionId) {
        e.stopPropagation();
        await api.delete(`/sessions/${sessionId}`);
        if (activeSession === sessionId) startNewChat();
        loadSessions();
    }

    return (
        <div className="layout">
            <div className="sidebar">
                <button className="newChatBtn" onClick={startNewChat}>
                    + New Chat
                </button>

                <div className="sessionList">
                    {sessions.map((s) => (
                        <div
                            key={s.id}
                            className={
                                "sessionItem" +
                                (s.id === activeSession ? " activeSession" : "")
                            }
                            onClick={() => openSession(s.id)}
                        >
                            <span className="sessionTitle">{s.title}</span>
                            <span
                                className="deleteBtn"
                                onClick={(e) => deleteSession(e, s.id)}
                            >
                                ✕
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="container">
                <div className="header">LangGraph Chatbot</div>

                <div className="chat">
                    {messages.map((msg, index) => (
                        <div
                            key={index}
                            className={msg.sender === "user" ? "user" : "bot"}
                        >
                            {msg.text}
                        </div>
                    ))}

                    {loading && <div className="bot">Thinking...</div>}
                    <div ref={bottomRef} />
                </div>

                <div className="inputArea">
                    <input
                        value={question}
                        placeholder="Ask anything..."
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    />
                    <button onClick={sendMessage}>Send</button>
                </div>
            </div>
        </div>
    );
}

export default ChatBox;