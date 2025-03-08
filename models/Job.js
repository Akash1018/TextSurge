import mongoose from "mongoose";

const JobSchema = new mongoose.Schema({
    company: String,
    position: String,
    jobId: String,
    status: {type: String, default: "pending"},
}, {timestamps: true})

export default mongoose.model("Job", JobSchema);