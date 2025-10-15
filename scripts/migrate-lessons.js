const mongoose = require("mongoose");
const Lesson = require("./models/lesson.model"); // Your Lesson model

async function migrateLessons() {
  const dbHost = process.env.MONGO_HOST;
  const dbPort = process.env.MONGO_PORT;
  const dbName = process.env.MONGO_DB;
  const connectionString = `mongodb://<span class="math-inline">\{dbHost\}\:</span>{dbPort}/${dbName}`; // Construct connection string
  try {
    await mongoose.connect(connectionString);
    console.log("Connected to MongoDB");
    console.log("Connected to MongoDB");

    const lessons = await Lesson.find({}); // Get all lessons

    for (const lesson of lessons) {
      if (typeof lesson.level === "string") {
        console.log(`Updating lesson ${lesson._id}: Converting level to array`);
        lesson.level = [lesson.level]; // Convert to array
        await lesson.save();
      }
    }

    console.log("Lesson migration complete!");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  } finally {
    mongoose.disconnect();
  }
}

migrateLessons();
