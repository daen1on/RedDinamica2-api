const mongoose = require('mongoose');
const { MONGO_HOST, MONGO_PORT, MONGO_DB } = process.env;
const connectionUrl = `mongodb://${MONGO_HOST}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;

const initData = require('./initData');

const options = {
    family:4
};

module.exports = (() => {
    let instance = null,
        isDisconnecting = false;
    
    async function connect() {
        console.log("Starting mongodb connection.");
        try {
          await mongoose.connect(connectionUrl, options);
          console.log(`MongoDB is connected`);
          instance = mongoose;
          return instance;
        } catch (err) {
            console.log("could not connect to MongoDB");
            console.log(err);
        }
      }
      
      async function disconnect() {
        if (instance && !isDisconnecting) {
          isDisconnecting = true;
          console.log("Disconnecting mongo instance");
          try {
            await mongoose.disconnect();
            console.log("Mongo instance was disconnected");
            resolve();
          } catch (err) {
            console.log("Issue at the time of disconnecting the Mongo instance.");
            console.log(err);
            isDisconnecting = false;
          }
        }
      }
      

    return {
        connect,
        disconnect,
        mongoose
    }
})();
