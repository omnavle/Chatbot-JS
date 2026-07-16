import express from "express";
import cors from "cors";
import { app } from "./graph.js";

const server = express();

server.use(cors());
server.use(express.json());

server.post("/chat", async (req, res) => {
    try {
        const { message } = req.body;

        const finalState = await app.invoke(
            {
                messages: [
                    {
                        role: "user",
                        content: message,
                    },
                ],
            },
            {
                configurable: {
                    thread_id: "1",
                },
            }
        );

        const lastMessage =
            finalState.messages[finalState.messages.length - 1];

        res.json({
            reply: lastMessage.content,
        });
    } catch (err) {
        console.log(err);

        res.status(500).json({
            error: err.message,
        });
    }
});

server.listen(5000, () =>
    console.log("Server running on port 5000")
);