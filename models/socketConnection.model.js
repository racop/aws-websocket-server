const mongoose = require('mongoose');

const SocketConnectionSchema = new mongoose.Schema({
  connectionId: {
    type: String,
    default: "",
  },
  createdAt: {
    type: Number,
    default: Date.now(),
  },
});
SocketConnectionSchema.index({ createdAt: 1 });

const SocketConnection = mongoose.model('socketConnection', SocketConnectionSchema);

module.exports = SocketConnection;