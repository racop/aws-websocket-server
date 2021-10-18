/*
This package is used to create socket.io like interface for AWS WebSocket Server API
*/
const AWS = require("aws-sdk");
const SocketConnection = require("../models/socketConnection.model.js");
const SocketChannel = require("../models/socketChannel.model.js");
const connectToMongoDB = require("../mongoose.js");

class AwsWebSocketServerWrapper {
  constructor(config = {}) {
    const {
      mongoDBURI,
      socketConnectionModel = SocketConnection,
      socketChannelModel = SocketChannel,
      debug = false,
    } = config;
    if (typeof mongoDBURI === "undefined") {
      if(this.debug)
      console.log("Missing MongoDB URI");
      return;
    }
    this.mongoDBURI = mongoDBURI;
    this.socketConnection = socketConnectionModel;
    this.socketChannel = socketChannelModel;
    this.debug = debug;
    this._to = false;
    this._in = false;
    this._emit = false;
    this._broadcast = false;
  }

  connectMongo = async() => {
    return await connectToMongoDB(this.mongoDBURI);
  }

  connectGateway(domainName, stage) {
    return new AWS.ApiGatewayManagementApi({
      apiVersion: "2018-11-29",
      endpoint: domainName + "/" + stage,
    });
  }

  addConnection = async (connectionId) => {
    try {
      await this.connectMongo();
      const data = {
        connectionId: connectionId,
      };
      return await new this.socketConnection(data).save();
    } catch (e) {
      if(this.debug)
      console.log("addConnection error ", e.stack);
      return { statusCode: 500, body: e.stack };
    }
  };

  removeConnection = async (connectionId) => {
    try {
      if (typeof connectionId === "undefined") {
        return { statusCode: 404, body: "Missing conncetion Id" };
      }
      await this.connectMongo();
      await this.deleteConnectionChannel(connectionId);
      return await this.socketConnection.deleteOne({ connectionId });
    } catch (e) {
      if(this.debug)
      console.log("deleteConnection error ", e.stack);
      return { statusCode: 500, body: e.stack };
    }
  };

  deleteConnectionChannel = async(connectionId) => {
    try {
      if (typeof connectionId === "undefined") {
        if(this.debug)
        console.log("Missing conncetion Id");
        return { statusCode: 404, body: "Missing conncetion Id" };
      }
      await this.connectMongo();
      return await this.socketChannel.deleteMany({ connectionId });
    } catch (e) {
      if(this.debug)
      console.log("deleteConnectionChannel error ", e.stack);
      return { statusCode: 500, body: e.stack };
    }
  }

  subscribe = async(channelName, connectionId) => {
    try {
      await this.connectMongo();
      const data = {
        connectionId: connectionId,
        channelName: channelName,
      };
      return await new this.socketChannel(data).save();
    } catch (e) {
      if(this.debug)
      console.log("subscribe error ", e.stack);
      return { statusCode: 500, body: e.stack };
    }
  }

  unsubscribe = async(channelName, connectionId) => {
    try {
      await this.connectMongo();

      return await new this.socketChannel.deleteOne({
        channelName,
        connectionId,
      });
    } catch (e) {
      if(this.debug)
      console.log("unsubscribe error ", e.stack);
      return { statusCode: 500, body: e.stack };
    }
  }

  to(channel) {
    this._to = channel;
    return this;
  }

  in(channel) {
    this._in = channel;
    return this;
  }

  emit = async (event, listener, data) => {
    this._emit = data;
    await this.connectMongo();
    if (this._broadcast) {
      // Get all connected clients and push message to them
      let connectionData;
      try {
        connectionData = await this.socketConnection
          .find()
          .select("connectionId -_id")
          .lean();
      } catch (e) {
        return { statusCode: 500, body: e.stack };
      }
      let tmpData = {
        event: listener,
        body: data,
      };
      const postData = JSON.stringify(tmpData);

      this._broadcast = false;
      return await this.sendMessageToConnections(
        event,
        connectionData,
        postData
      );
    } else if (this._to) {
      // to all clients in room1 except the sender connectionId
      // to all clients in room1 and/or room2 except the sender, if this._to = ["room1", "room2"]
      let connectionData;
      const channelName = Array.isArray(this._to) ? this._to : [this._to];
      try {
        connectionData = await this.socketChannel
          .distinct("connectionId", {
            channelName: { $in: channelName },
            connectionId: { $ne: event.requestContext.connectionId },
          })
          .lean();
      } catch (e) {
        return { statusCode: 500, body: e.stack };
      }
      const mapConnectionData = await this.mapConnections(connectionData);
      let tmpData = {
        event: listener,
        body: data,
      };
      const postData = JSON.stringify(tmpData);

      this._to = false;
      return await this.sendMessageToConnections(
        event,
        mapConnectionData,
        postData
      );
    } else if (this._in) {
      // to all clients in room1
      // to all clients in room1 and/or room2 , where this._in = ["room1", "room2"]
      let connectionData;
      const channelName = Array.isArray(this._in) ? this._in : [this._in];
      try {
        connectionData = await this.socketChannel
          .distinct("connectionId", { channelName: { $in: channelName } })
          .lean();
      } catch (e) {
        return { statusCode: 500, body: e.stack };
      }
      const mapConnectionData = await this.mapConnections(connectionData);
      let tmpData = {
        event: listener,
        body: data,
      };
      const postData = JSON.stringify(tmpData);
      // Reset value to false
      this._in = false;
      return await this.sendMessageToConnections(
        event,
        mapConnectionData,
        postData
      );
    }
    return this;
  };

  broadcast = () => {
    this._broadcast = true;
    return this;
  };

  sendMessageToConnections = async (event, connectionData, message) => {
    const postCalls = connectionData.map(async ({ connectionId }) => {
      try {
        await this.connectGateway(
          event.requestContext.domainName,
          event.requestContext.stage
        )
          .postToConnection({ ConnectionId: connectionId, Data: message })
          .promise();
      } catch (e) {
        if (e.statusCode === 410) {
          if(this.debug)
          console.log(`Found stale connection, deleting ${connectionId} ${e}`);
          await this.deleteConnection(connectionId);
        } else {
          if(this.debug)
          console.log(`Unknown error${e}`);
          throw e;
        }
      }
    });

    try {
      await Promise.all(postCalls);
    } catch (e) {
      return { statusCode: 500, body: e.stack };
    }

    return { statusCode: 200, body: "Data sent." };
  };

  mapConnections = async (connectionData) => {
    const mappedConnection = connectionData.map(p=>({connectionId: p}));
    try {
      await Promise.all(mappedConnection);
    } catch (e) {
      return [];
    }
    return mappedConnection;
  };
}

module.exports = AwsWebSocketServerWrapper;
