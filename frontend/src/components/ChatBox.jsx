import { useState, useEffect, useRef } from "react";
import api from "../api";
import "./ChatBox.css";

/* ---------- Icons ---------- */

const IconPlus = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
);
const IconTrash = () => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <path d="M3 5h10M6.5 5V3.5h3V5M4.5 5l.6 8h5.8l.6-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const IconPencil = () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M11.3 2.3a1 1 0 011.4 0l1 1a1 1 0 010 1.4L5.4 13H3v-2.4l8.3-8.3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
);
const IconSend = () => (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
        <path d="M17.5 2.5L2.5 9l6 2.5L11 17.5l6.5-15z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
);
const IconSpark = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 2l2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2z" fill="currentColor" />
    </svg>
);
const IconMenu = () => (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
        <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);
const IconCheck = () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const IconX = () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
);

/* ---------- Helpers ---------- */

function formatTime(date) {
    return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function groupSessions(sessions) {
    const groups = { Today: [], Yesterday: [], Older: [] };
    const now = new Date();
    sessions.forEach((s) => {
        const d = new Date(s.created_at);
        const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) groups.Today.push(s);
        else if (diffDays === 1) groups.Yesterday.push(s);
        else groups.Older.push(s);
    });
    return groups;
}

const SUGGESTIONS = [
    "Summarize the latest news on AI regulation",
    "Explain how LangGraph agents route tool calls",
    "Draft a plan to learn Postgres in a week",
];

const MOBILE_BREAKPOINT = 820;

/* ---------- Component ---------- */

function ChatBox() {
    const [sessions, setSessions] = useState([]);
    const [activeSession, setActiveSession] = useState(null);
    const [messages, setMessages] = useState([]);
    const [question, setQuestion] = useState("");
    const [loading, setLoading] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);

    const [renamingId, setRenamingId] = useState(null);
    const [renameValue, setRenameValue] = useState("");

    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState("");

    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > MOBILE_BREAKPOINT);

    const bottomRef = useRef(null);
    const textareaRef = useRef(null);
    const editTextareaRef = useRef(null);

    useEffect(() => {
        loadSessions();
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    useEffect(() => {
        if (editingId && editTextareaRef.current) {
            editTextareaRef.current.focus();
            editTextareaRef.current.style.height = "auto";
            editTextareaRef.current.style.height = editTextareaRef.current.scrollHeight + "px";
        }
    }, [editingId]);

    function closeSidebarOnMobile() {
        if (window.innerWidth <= MOBILE_BREAKPOINT) setSidebarOpen(false);
    }

    async function loadSessions() {
        const res = await api.get("/sessions");
        setSessions(res.data);
    }

    async function openSession(sessionId) {
        setActiveSession(sessionId);
        setEditingId(null);
        const res = await api.get(`/sessions/${sessionId}/messages`);
        setMessages(
            res.data.map((m) => ({
                id: m.id,
                sender: m.role === "user" ? "user" : "bot",
                text: m.content,
                time: m.created_at,
            }))
        );
        closeSidebarOnMobile();
    }

    function startNewChat() {
        setActiveSession(null);
        setMessages([]);
        setEditingId(null);
        closeSidebarOnMobile();
    }

    function autoGrow() {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }

    async function sendMessage() {
        if (!question.trim() || loading) return;

        const tempId = `temp-${Date.now()}`;
        const userMessage = { id: tempId, sender: "user", text: question, time: Date.now() };
        setMessages((prev) => [...prev, userMessage]);

        const current = question;
        setQuestion("");
        requestAnimationFrame(autoGrow);
        setLoading(true);

        try {
            const res = await api.post("/chat", {
                session_id: activeSession,
                message: current,
            });

            setMessages((prev) => {
                const updated = prev.map((m) =>
                    m.id === tempId ? { ...m, id: res.data.user_message_id } : m
                );
                return [
                    ...updated,
                    { id: res.data.bot_message_id, sender: "bot", text: res.data.reply, time: Date.now() },
                ];
            });

            if (!activeSession) {
                setActiveSession(res.data.session_id);
                loadSessions();
            }
        } catch {
            setMessages((prev) => [
                ...prev,
                { sender: "bot", text: "Something went wrong. Please try again.", time: Date.now() },
            ]);
        }

        setLoading(false);
    }

    function handleKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    /* ---- Delete session ---- */

    function requestDelete(e, session) {
        e.stopPropagation();
        setPendingDelete(session);
    }

    async function confirmDelete() {
        if (!pendingDelete) return;
        await api.delete(`/sessions/${pendingDelete.id}`);
        if (activeSession === pendingDelete.id) startNewChat();
        setPendingDelete(null);
        loadSessions();
    }

    /* ---- Rename session ---- */

    function startRename(e, session) {
        e.stopPropagation();
        setRenamingId(session.id);
        setRenameValue(session.title);
    }

    async function saveRename(session) {
        const title = renameValue.trim();
        setRenamingId(null);
        if (!title || title === session.title) return;

        setSessions((prev) => prev.map((s) => (s.id === session.id ? { ...s, title } : s)));
        try {
            await api.patch(`/sessions/${session.id}`, { title });
        } catch {
            loadSessions(); // revert on failure
        }
    }

    function handleRenameKeyDown(e, session) {
        if (e.key === "Enter") { e.preventDefault(); saveRename(session); }
        if (e.key === "Escape") setRenamingId(null);
    }

    /* ---- Edit message ---- */

    function startEdit(message) {
        if (loading || typeof message.id !== "number") return;
        setEditingId(message.id);
        setEditValue(message.text);
    }

    function cancelEdit() {
        setEditingId(null);
        setEditValue("");
    }

    async function saveEdit(message) {
        const content = editValue.trim();
        if (!content) return;

        const idx = messages.findIndex((m) => m.id === message.id);
        const truncated = messages.slice(0, idx);
        truncated.push({ ...message, text: content });

        setMessages(truncated);
        setEditingId(null);
        setLoading(true);

        try {
            const res = await api.put(`/sessions/${activeSession}/messages/${message.id}`, {
                content,
            });
            setMessages((prev) => [
                ...prev,
                { id: res.data.bot_message_id, sender: "bot", text: res.data.reply, time: Date.now() },
            ]);
        } catch {
            setMessages((prev) => [
                ...prev,
                { sender: "bot", text: "Something went wrong regenerating that reply.", time: Date.now() },
            ]);
        }

        setLoading(false);
    }

    const grouped = groupSessions(sessions);

    return (
        <div className="relay-app">
            {sidebarOpen && (
                <div className="backdrop" onClick={() => setSidebarOpen(false)} />
            )}

            {/* ---------- Sidebar ---------- */}
            <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
                <div className="brand">
                    <span className="brand-mark"><IconSpark /></span>
                    <span className="brand-name">Relay</span>
                </div>

                <button className="newChatBtn" onClick={startNewChat}>
                    <IconPlus />
                    New chat
                </button>

                <div className="sessionList">
                    {Object.entries(grouped).map(([label, items]) =>
                        items.length ? (
                            <div key={label} className="sessionGroup">
                                <div className="groupLabel">{label}</div>
                                {items.map((s) => (
                                    <div
                                        key={s.id}
                                        className={
                                            "sessionItem" +
                                            (s.id === activeSession ? " activeSession" : "")
                                        }
                                        onClick={() => renamingId !== s.id && openSession(s.id)}
                                    >
                                        {renamingId === s.id ? (
                                            <input
                                                className="renameInput"
                                                value={renameValue}
                                                autoFocus
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={(e) => setRenameValue(e.target.value)}
                                                onBlur={() => saveRename(s)}
                                                onKeyDown={(e) => handleRenameKeyDown(e, s)}
                                            />
                                        ) : (
                                            <span className="sessionTitle">{s.title}</span>
                                        )}

                                        <div className="sessionActions">
                                            <button
                                                className="iconBtn"
                                                onClick={(e) => startRename(e, s)}
                                                aria-label="Rename chat"
                                            >
                                                <IconPencil />
                                            </button>
                                            <button
                                                className="iconBtn danger"
                                                onClick={(e) => requestDelete(e, s)}
                                                aria-label="Delete chat"
                                            >
                                                <IconTrash />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null
                    )}

                    {sessions.length === 0 && (
                        <div className="emptySidebar">No conversations yet</div>
                    )}
                </div>
            </aside>

            {/* ---------- Main chat ---------- */}
            <main className="chatPanel">
                <header className="chatHeader">
                    <button
                        className="menuBtn"
                        onClick={() => setSidebarOpen((v) => !v)}
                        aria-label="Toggle sidebar"
                    >
                        <IconMenu />
                    </button>

                    <div className="headerTitle">
                        <span className="statusDot" />
                        Relay Agent
                    </div>
                    <span className="headerSub">gpt-oss-120b · web search enabled</span>
                </header>

                <div className="chat">
                    {messages.length === 0 && !loading && (
                        <div className="emptyState">
                            <div className="emptyIcon"><IconSpark /></div>
                            <h2>What can I help you find?</h2>
                            <p>Ask a question, and Relay will search the web when it needs to.</p>
                            <div className="suggestions">
                                {SUGGESTIONS.map((s) => (
                                    <button key={s} className="suggestionChip" onClick={() => setQuestion(s)}>
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((msg, index) => (
                        <div key={msg.id ?? index} className={`messageRow ${msg.sender}`}>
                            <div className="avatar">{msg.sender === "user" ? "You" : <IconSpark />}</div>
                            <div className="messageBody">
                                {editingId === msg.id ? (
                                    <div className="editBox">
                                        <textarea
                                            ref={editTextareaRef}
                                            value={editValue}
                                            onChange={(e) => {
                                                setEditValue(e.target.value);
                                                e.target.style.height = "auto";
                                                e.target.style.height = e.target.scrollHeight + "px";
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    saveEdit(msg);
                                                }
                                                if (e.key === "Escape") cancelEdit();
                                            }}
                                        />
                                        <div className="editActions">
                                            <button className="editBtn cancel" onClick={cancelEdit}>
                                                <IconX /> Cancel
                                            </button>
                                            <button className="editBtn save" onClick={() => saveEdit(msg)}>
                                                <IconCheck /> Save &amp; regenerate
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="bubble-wrap">
                                            <div className={`bubble ${msg.sender}`}>{msg.text}</div>
                                            {msg.sender === "user" && (
                                                <button
                                                    className="editTrigger"
                                                    onClick={() => startEdit(msg)}
                                                    aria-label="Edit message"
                                                >
                                                    <IconPencil />
                                                </button>
                                            )}
                                        </div>
                                        <div className="timestamp">{formatTime(msg.time)}</div>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div className="messageRow bot">
                            <div className="avatar"><IconSpark /></div>
                            <div className="messageBody">
                                <div className="bubble bot typing">
                                    <span className="dot" />
                                    <span className="dot" />
                                    <span className="dot" />
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={bottomRef} />
                </div>

                <div className="inputArea">
                    <textarea
                        ref={textareaRef}
                        value={question}
                        placeholder="Message Relay..."
                        rows={1}
                        onChange={(e) => {
                            setQuestion(e.target.value);
                            autoGrow();
                        }}
                        onKeyDown={handleKeyDown}
                    />
                    <button
                        className="sendBtn"
                        onClick={sendMessage}
                        disabled={!question.trim() || loading}
                        aria-label="Send message"
                    >
                        <IconSend />
                    </button>
                </div>
            </main>

            {/* ---------- Delete confirmation modal ---------- */}
            {pendingDelete && (
                <div className="modalOverlay" onClick={() => setPendingDelete(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Delete chat?</h3>
                        <p>
                            "{pendingDelete.title}" and all its messages will be permanently
                            removed. This can't be undone.
                        </p>
                        <div className="modalActions">
                            <button className="modalCancel" onClick={() => setPendingDelete(null)}>Cancel</button>
                            <button className="modalDelete" onClick={confirmDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ChatBox;