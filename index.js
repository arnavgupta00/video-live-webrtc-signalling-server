const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

const rooms = {};
const rooomClients = {};
var roomList = [
  "Room1",
  "Room2",
  "Room3",
  "Room4",
  "Room5",
  "Room6",
  "Room7",
  "Room8",
  "Room9",
  "Room10",
];

const roomListInitiator = () => { 
  roomList.forEach(roomId => {
    if (!rooms[roomId]) {
      rooms[roomId] = [];
      rooomClients[roomId] = []
    }
  });
  
};

roomListInitiator();
wss.on('connection', (ws) => {

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    switch (data.type) {
      case 'joinRoom':
        handleJoinRoom(ws, data);
        break;
      case 'createRoom':
        handleCreateRoom(ws, data);
        break;
      case 'offer':
        handleOffer(ws, data);
        break;
      case 'answer':
        handleAnswer(ws, data);
        break;
      case 'iceCandidate':
        handleIceCandidate(ws, data);
        break;
      case 'disconnect':
        handleDisconnect(ws);
        break;
      case 'clientList':
        handleClientList(ws);
        break;
      case "chat":
        handleChat(ws, data);
        break
      default:
        console.log(message);
    }
  });
  ws.on('close', (code, reason) => {
    console.log("close initiated")
    try {
      handleDisconnect(ws)
    }
    catch (err) {
      console.log(err);
    }
  });
});

const generateClientId = () => {
  return Math.random().toString(36).substring(7);
};

const handleJoinRoom = (ws, data) => {
  const { roomId, userId } = data;

  // add the client to the room
  if (!rooms[roomId]) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: "roomDNE",
    }));
  } else {
    const clientId = generateClientId();
    ws.roomId = roomId;
    rooms[roomId].push({ id: clientId, userId });
    ws.id = clientId;

    // notify others in the same room about the new user
    const clientsArray = Array.from(wss.clients);

    rooms[roomId].forEach((user) => {
      rooomClients[roomId].push(user.id);
      const client = clientsArray.find((client) => client.id === user.id);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'userJoined',
          payload: { userId, socketId: clientId, allUsers: rooms[roomId] },
        }));
      }
    });
    //
    // notify the new user about existing users

    const listCPY = rooomClients[roomId].filter(id => id !== ws.id);

    ws.send(JSON.stringify({
      type: 'clientList',
      list: listCPY,
    }));
    ws.send(JSON.stringify({
      type: 'initialClientList',
      list: listCPY,
    }));
    ws.send(JSON.stringify({
      type: 'allUsers',
      payload: rooms[roomId],
    }));
  }



};

const handleClientList = (ws) => {

  var roomId = ws.roomId;
  const clientsArray = Array.from(wss.clients);

  rooms[roomId].forEach((user) => {
    rooomClients[roomId].push(user.id);
  });

  var listClientsSet = new Set(rooomClients[roomId])
  var listClients = Array.from(listClientsSet);

  const listCPY = listClients.filter(id => id !== ws.id);

  rooms[roomId].forEach((user) => {
    
    const client = clientsArray.find((client) => client.id === user.id);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'clientList',
        list: listCPY,
      }));
    }
  });
}

const handleCreateRoom = (ws, data) => {
  const { roomId, userId } = data;

  // add the client to the room
  if (!rooms[roomId]) {
    rooms[roomId] = [];
    rooomClients[roomId] = []
  }
  const clientId = generateClientId();
  ws.roomId = roomId;
  ws.id = clientId;

  rooms[roomId].push({ id: ws.id, userId });
  rooomClients[roomId].push(ws.id);
  console.log(rooms[roomId]);




  // notify the new user about existing users
  ws.send(JSON.stringify({
    type: 'allUsers',
    payload: rooms[roomId],
  }));


};


const handleOffer = (ws, data) => {

  

  const clientsArray = Array.from(wss.clients);
  rooms[ws.roomId].forEach((user) => {
    const client = clientsArray.find((client) => client.id === user.id);
    if (client.id === data.target && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'offer',
        payloadOffer: data.offer,
        senderID: ws.id, //we send ws.id here so the id created in frontend is useless in backend
        negotiation: data.negotiation,
      }));

      
    }
  });
};

const handleAnswer = (ws, data) => {
  
  const clientsArray = Array.from(wss.clients);
  rooms[ws.roomId].forEach((user) => {
    const client = clientsArray.find((client) => client.id === user.id);
    if (client.id === data.target && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'answer',
        answer: data.answer,
        senderID: ws.id,
        negotiation: data.negotiation,
      }));
      console.log(`ANSWER SENT FROM ${ws.id} TO ${data.target}`)
      
    }

  });
};

const handleIceCandidate = (ws, data) => {
  const clientsArray = Array.from(wss.clients);
  
  rooms[ws.roomId].forEach((user) => {
    const client = clientsArray.find((client) => client.id === user.id);
    if (client.id === data.target && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'candidate',
        candidate: data.candidate,
        senderID: ws.id,
      }));
      console.log(`ICE CANDIDATE SENT FROM ${ws.id} TO ${client.id}`, data)
    }
  });

};

const handleChat = (ws, data) => {
  const clientsArray = Array.from(wss.clients);
  rooms[ws.roomId].forEach((user) => {
    const client = clientsArray.find((client) => client.id === user.id);
    if (client.id !== ws.id && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'chat',
        message: data.message,
        senderID: ws.id,
        senderName: data.senderName,

      }));
      console.log(`CHAT SENT FROM ${ws.id} TO ${client.id}`, data)
    }
  });
}

const handleDisconnect = (ws) => {

  roomid = ws.roomId;

  if (rooms[roomid]) {
    const index = rooms[roomid].findIndex((user) => user.id === ws.id);
    if (index > -1) {
      rooms[roomid].splice(index, 1);
    }
  }
};



server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

