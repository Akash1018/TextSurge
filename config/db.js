import mongoose from "mongoose";

const connectDB = async () => {
    try {
        // add this to env
        await mongoose.connect(process.env.DB, { useNewUrlParser: true, useUnifiedTopology: true })
        console.log("MongoDB connected");
    } catch (error) {
        console.log("MongoDB Connection Error", error);
        process.exit(1);
    }
}

export default connectDB;