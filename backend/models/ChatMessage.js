import { DataTypes } from "sequelize";
import { sequelize } from "../db.js";
import ChatSession from "./ChatSession.js";

const ChatMessage = sequelize.define(
    "ChatMessage",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        session_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        role: {
            type: DataTypes.STRING, 
            allowNull: false,
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
    },
    {
        tableName: "chat_messages",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: false,
    }
);

// Relationships
ChatSession.hasMany(ChatMessage, { foreignKey: "session_id", onDelete: "CASCADE" });
ChatMessage.belongsTo(ChatSession, { foreignKey: "session_id" });

export default ChatMessage;