const mongoose = require('mongoose');

const SocketChannelSchema = new mongoose.Schema({
  connectionId: {
    type: String,
    default: "",
  },
  channelName: {
    type: String,
    default: "",
  },
  createdAt: {
    type: Number,
    default: Date.now(),
  },
});
SocketChannelSchema.index({ createdAt: 1 });

const SocketChannel = mongoose.model('socketChannel', SocketChannelSchema);

module.exports = SocketChannel;