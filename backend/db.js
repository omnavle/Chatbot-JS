import { Sequelize } from "sequelize";
import "dotenv/config";

export const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: "postgres",
    logging: false,
});

export async function connectDB() {
    try {
        await sequelize.authenticate();
        console.log("Postgres connected");
    } catch (err) {
        console.error("DB connection error:", err);
    }
}