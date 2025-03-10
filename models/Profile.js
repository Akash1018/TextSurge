import mongoose from "mongoose"

const ProfileSchema = new  mongoose.Schema({
    jobId: mongoose.Schema.Types.ObjectId,
    linkedinUrl: {type: String, required: true},
    company: String,
    status: {type: String, default: "Connect"},
}, {timestamps: true})

export default mongoose.model("Profile", ProfileSchema);
