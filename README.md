# aws-websocket-server

### Info
```
Add Socket.io like wrapper to AWS WebSocket server(NodeJS serverless)
This package uses MongoDB as database to record connection & channel subscription.
```

### Download
```
npm install aws-websocket-server
```

### Requirements
```
- Vaild MongoDB Url
- API WEBSOCKET Endpoint from AWS
- AWS Websocket client wrapper to communicate with client using server wrapper.
  npm install aws-websocket-client
  Github:- https://github.com/racop/aws-websocket-client
```

### How to Use
```
import AWSWebSocketServer from "aws-websocket-server";
const DB_URI = "mongodb+srv://username:password@connection_url"; // You mongodb connection url
const socket = new AWSWebSocketServer({
  mongoDBURI: DB_URI,
  socketConnectionModel = SocketConnection, // Optional, By default uses ./models/socketConnection.model.js
  socketChannelModel = SocketChannel, // Optional, By default uses ./models/socketChannel.model.js
  debug: false,
})
```

### Inside handlers

On connectHandler 
```
module.exports.connectHandler = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  socket.addConnection(event.requestContext.connectionId) // Register connection in socket
    .then(() => {
      // do something like subscribe to channels
      socket.subscribe('global', event.requestContext.connectionId); // Subscribed to channel name global
      callback(null, successfullResponse)
    })
    .catch((err) => {
      callback({statusCode: 500,body: JSON.stringify(err)})
    })
}
```


On disconnectHandler 
```
module.exports.disconnectHandler = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  socket.deleteConnection(event.requestContext.connectionId) // DeRegister connection in socket
    .then(() => {
      callback(null, successfullResponse)
    })
    .catch((err) => {
      console.log(err)
      callback(failedResponse(500, JSON.stringify(err)))
    })
}
```


On subscribeHandler 
```
module.exports.subscribeHandler = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  const channelName = JSON.parse(event.body).data;
  socket.subscribe(channelName, event.requestContext.connectionId) // Subscribe the channel
    .then(() => {
      callback(null, successfullResponse)
    })
    .catch((err) => {
      console.log(err)
      callback(failedResponse(500, JSON.stringify(err)))
    })
}
```


On unsubscribeHandler 
```
module.exports.unsubscribeHandler = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  const channelName = JSON.parse(event.body).data;
  socket.subscribe(channelName, event.requestContext.connectionId) // Unsubscribe the channel
    .then(() => {
      callback(null, successfullResponse)
    })
    .catch((err) => {
      console.log(err)
      callback(failedResponse(500, JSON.stringify(err)))
    })
}
```


On sendMessageHandler 
```
module.exports.sendMessageHandler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  const connectionId = event.requestContext.connectionId; // Client connectionId

  const data = JSON.parse(event.body).data;
  const eventListener = data.event; // EventListener received from client
  const messageBody = data.body; // Received Data from client

  // Do something based on the eventListener and data received from client
  await socket.in("global").emit(event, 'online', messageBody); // Send message to all clients subscribed to global channel on online listener.
  return { statusCode: 200, body: 'Data sent.' };
};
```

### Emit CheatSheet
```
socket.broadcast().emit(event, listener, message); // Send message to all connected clients with on provided listener
Eg:-
// This can be used to inform all clients listening to online listener about Bob
await socket.broadcast().emit(event, 'online', {name:"Bob"}); 


await socket.to("global").emit(event, 'friend_request', message); // Send message to all clients subscribed to global channel except sender
Eg:-
// Send message to all clients subscribed to global channel on frined_request listener except sender.
await socket.to("global").emit(event, 'friend_request', {id:1, name: "John"}); 


await socket.to("global").emit(event, 'friend_request', message); // Send message to all clients subscribed to global channel including sender
Eg:-
// Send message to all clients subscribed to global channel on frined_request listener including sender.
await socket.to("global").emit(event, 'friend_request', {id:1, name: "John"}); 

```