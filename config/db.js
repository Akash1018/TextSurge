import mongoose from "mongoose";

const connectDB = async () => {
    try {
        // add this to env
        await mongoose.connect("mongodb+srv://akash101811:o9FkYY8ipjB5eS26@cluster0.vgds6.mongodb.net/", { useNewUrlParser: true, useUnifiedTopology: true })
        console.log("MongoDB connected");
    } catch (error) {
        console.log("MongoDB Connection Error", error);
        process.exit(1);
    }
}

export default connectDB;