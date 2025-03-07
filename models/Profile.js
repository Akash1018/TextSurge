import mongoose from "mongoose"

const ProfileSchema = new  mongoose.Schema({
    jobId: mongoose.Schema.Types.ObjectId,
    linkedinUrl: {type: String, required: true},
    status: {type: String, default: "Connect"},
}) 

export default mongoose.model("Profile", ProfileSchema);
