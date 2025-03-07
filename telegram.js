import TelegramBot from "node-telegram-bot-api";
import processJobs from "./bot.js";
import { configDotenv } from "dotenv";
import Job from "./models/Job.js";
configDotenv();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {polling: true});

bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (userId.toString() !== process.env.TELEGRAM_USER_ID) return; // Ignore other users

    const text = msg.text.trim();
    const jobData = parseJobMessage(text);

    if(!jobData) {
        bot.sendMessage(chatId, "❌ Invalid format! Please send:\nCompany: XYZ\nPosition: ABC\nJob ID: 123");
        return;
    }

    const job = new Job(jobData);
    await job.save();

    bot.sendMessage(chatId, `✅ Job added:\n📍 Company: ${jobData.company}\n💼 Position: ${jobData.position}\n🆔 Job ID: ${jobData.jobId}`);

    // Start processing jobs
    processJobs();
})

const parseJobMessage = (text) => {
    const regex = /Company:\s*(.+)\nPosition:\s*(.+)\nJob ID:\s*(.+)/i;
    const match = text.match(regex);

    if (!match) return null;

    return {
        company: match[1].trim(),
        position: match[2].trim(),
        jobId: match[3].trim(),
    };
}

export default bot;