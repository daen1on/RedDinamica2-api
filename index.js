require('dotenv').config();

const PORT = process.env.PORT || 3800;
const mongoose = require("./db/connect");
const app = require('./app');
const initData = require('./db/initData');
const cronController = require('./controllers/cron.controller');

async function initDB(){
    const db = await mongoose.connect();
    if (db) { initApp(); }
}


async function initApp(){
  
    // Inicializar seeds de usuarios (ahora con async/await)
    try { 
        await initData.createLessonManager();
    } catch(e) { 
        console.log('Init seed lesson_manager failed:', e?.message); 
    }
    
    // Inicializar cron job de resúmenes mensuales
    try { 
        cronController.initMonthlyDigestCron();
    } catch (error) {
        console.error("Error initializing monthly digest cron:", error);
    }
    
    console.log("Starting server");
    app.listen(PORT, ()=>{
        console.log(`Server is up on port: ${PORT}`);
    });
    process.on("SIGINT", closeApp);
    process.on("SIGTERM", closeApp);
}

function closeApp(){
    mongoose.disconnect()
        .then(()=>process.exit(0));
}

initDB();


