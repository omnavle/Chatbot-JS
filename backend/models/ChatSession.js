import { DataTypes } from "sequelize";
import { sequelize } from "../db.js";

const ChatSession = sequelize.define(
    "ChatSession",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        title: {
            type: DataTypes.STRING,
            defaultValue: "New Chat",
        },
    },
    {
        tableName: "chat_sessions",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: false,
    }
);

export default ChatSession;