require('dotenv').config();

// Configure console verbosity early, before loading other modules that may log during import
(() => {
    const LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };
    const envLevel = String(process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'debug')).toLowerCase();
    const current = LEVELS.hasOwnProperty(envLevel) ? LEVELS[envLevel] : LEVELS.debug;
    const noop = () => {};
    if (current < LEVELS.debug) { console.debug = noop; }
    if (current < LEVELS.info)  { console.info = noop; console.log = noop; }
    if (current < LEVELS.warn)  { console.warn = noop; }
    // console.error always enabled
})();

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


