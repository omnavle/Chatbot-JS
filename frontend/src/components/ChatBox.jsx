import { useState } from "react";
import api from "../api";
import "./ChatBox.css";

function ChatBox() {

    const [messages, setMessages] = useState([]);

    const [question, setQuestion] = useState("");

    const [loading, setLoading] = useState(false);

    async function sendMessage() {

        if (!question.trim()) return;

        const userMessage = {
            sender: "user",
            text: question,
        };

        setMessages((prev) => [...prev, userMessage]);

        const current = question;

        setQuestion("");

        setLoading(true);

        try {

            const res = await api.post("/chat", {
                message: current,
            });

            const botMessage = {
                sender: "bot",
                text: res.data.reply,
            };

            setMessages((prev) => [...prev, botMessage]);

        } catch {

            setMessages((prev) => [
                ...prev,
                {
                    sender: "bot",
                    text: "Something went wrong.",
                },
            ]);

        }

        setLoading(false);

    }

    return (
        <div className="container">

            <div className="header">
                LangGraph Chatbot
            </div>

            <div className="chat">

                {messages.map((msg, index) => (

                    <div
                        key={index}
                        className={
                            msg.sender === "user"
                                ? "user"
                                : "bot"
                        }
                    >
                        {msg.text}
                    </div>

                ))}

                {loading && (
                    <div className="bot">
                        Thinking...
                    </div>
                )}

            </div>

            <div className="inputArea">

                <input
                    value={question}
                    placeholder="Ask anything..."
                    onChange={(e) =>
                        setQuestion(e.target.value)
                    }
                    onKeyDown={(e) =>
                        e.key === "Enter" && sendMessage()
                    }
                />

                <button onClick={sendMessage}>
                    Send
                </button>

            </div>

        </div>
    );
}

export default ChatBox;