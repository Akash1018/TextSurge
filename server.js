import express from "express";
import bodyParser from "body-parser";
import connectDB from "./config/db.js";
import bot from "./telegram.js";
import { configDotenv } from "dotenv";

configDotenv();

const app = express();
app.use(bodyParser.json());

connectDB();

app.post("/", () => {
    console.log("working");
})

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
