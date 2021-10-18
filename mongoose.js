const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
let isConnected;

module.exports = connectMongoDB = (DB_URI) => {
  if (isConnected) {
    console.log('=> using existing database connection');
    return Promise.resolve();
  }

  return mongoose.connect(DB_URI)
    .then(db => { 
      
      isConnected = db.connections[0].readyState;
      console.log('=> using new database connection ', isConnected);
    });
};