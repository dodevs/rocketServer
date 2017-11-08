var express = require('express'); //Modulo para o servidor backend
var http = require('http') //Para as conexões
var socketio = require('socket.io'); //Os soquetes né
var mongojs = require('mongojs'); //Conexão com o mongo
/**
 * OBS: O mongo só vai funcionar se tiver ele na sua maquina.
 * Ai tem que roda ele antes, no console dele da um 'show dbs' pra 
 * confirmar se tem a 'local'. Se nao tiver, cria.
 */

var ObjectID = mongojs.ObjectID; //Tipo a chave primária
var db = mongojs(process.env.MONGO_URL || 'mongodb://localhost:27017/local'); //link de conexão
var app = express(); //Instanciado com sucesso
var server = http.Server(app); //Nunca nem vi
var websocket = socketio(server); //Que dia foi isso
server.listen(3000, () => console.log('listening on *:3000'));

// Mapping objects to easily map sockets and users.
// -traduzido- Mepeando objetos para localizar facilmente os sockets e usuarios
var clients = {};
var users = {};

// This represents a unique chatroom.
// For this example purpose, there is only one chatroom;
// -traduzido- Só vai ter uma sala de batepapo (old expression ksksks)
var chatId = 1;

// Essa parte aqui Mateus manja
websocket.on('connection', (socket) => { //No evento da conexão, executa a função passando o socket
    clients[socket.id] = socket; //Adiciona o socket recebido ao objeto
    //Funções exclusivas para cada tipo de conexção
    /**
     * No cliente, quando a classe é instanciada, ja é feita a primeira conexão.
     * Ai entra a função 'onUserJoined()'
     */
    socket.on('userJoined', (userId) => onUserJoined(userId, socket)); 
    /**
     * A função 'onMessageReceived()' é executada toda vez que recebe uma mensagem 
     */
    socket.on('message', (message) => onMessageReceived(message, socket));
});

// Event listeners.
// -traduzido- Escutadores de eventos ksskskks
// When a user joins the chatroom.
// -traduzido- Quando um usuario entra na sala de batepapo
function onUserJoined(userId, socket) {
  try {
    // The userId is null for new users.
    // -traduzido- O userId é nulo para novos usuarios
    if (!userId) {
      var user = db.collection('users').insert({}, (err, user) => { // Na ação da inserção, passa o 'user' como parametro
        socket.emit('userJoined', user._id); // Reenvia com o id obitido na inserção
        users[socket.id] = user._id; //Adiciona o id no objeto
        _sendExistingMessages(socket); //Envia as mensagens já existentes
      });
    } else {
      // Adiciona o userId no objeto
      users[socket.id] = userId;
      _sendExistingMessages(socket); // Ver comentarios na função
    }
  } catch(err) {
    console.err(err);
  }
}

// When a user sends a message in the chatroom.
// -traduzido- Quando um usuario manda mensagem na sala de batepapo
function onMessageReceived(message, senderSocket) {
  // 'userId' recebe o 'id' correspondente na lista
  var userId = users[senderSocket.id];
  // Safety check.
  if (!userId) return;

  _sendAndSaveMessage(message, senderSocket);
}

// Helper functions.
// -traduzido- Funções de auxilio
// Send the pre-existing messages to the user that just joined.
// Envia as mensagens que já existem para o usuario que acabou de entrar
function _sendExistingMessages(socket) {
  var messages = db.collection('messages')
    .find({ chatId }) // 'messages' recebe a busca das mensagens excluindo o 'chatId' dos resultados
    .sort({ createdAt: 1 }) // esse resultado é ordenado pela data de criação
    .toArray((err, messages) => { // o reusltado retornado para a variavel 'messages' é convertido em string.
      // If there aren't any messages, then return.
      // -traduzido- Se nao tiver mensagens, apenas retorna
      // Obs: 'messages' passado na função 'toArray', são as proprias mensagens do banco de dados :o
      if (!messages.length) return;
      // Por fim, envia as mensagens da ultima para a primeira
      socket.emit('message', messages.reverse());
  });
}

// Save the message to the db and send all sockets but the sender.
// -traduzido- Salva a mensagem no banco de dados e envia todos os socket mais quem enviou
function _sendAndSaveMessage(message, socket, fromServer) {
  // Cria um objeto para ser salvo no mongo
  var messageData = {
    text: message.text,
    user: message.user,
    createdAt: new Date(message.createdAt),
    chatId: chatId
  };

  db.collection('messages').insert(messageData, (err, message) => {
    // If the message is from the server, then send to everyone.
    // -traduzido- Se a mensagem foi enviada pelo server, ira enviar para todos
    var emitter = fromServer ? websocket : socket.broadcast;
    // Envia a mensagem
    emitter.emit('message', [message]);
  });
}

// Allow the server to participate in the chatroom through stdin.
// -traduzido- Permite o servidor participar da sala de batepapo através desse 'stdin'
var stdin = process.openStdin();
stdin.addListener('data', function(d) {
  _sendAndSaveMessage({
    text: d.toString().trim(),
    createdAt: new Date(),
    user: { _id: 'robot' }
  }, null /* sem socket */, true /* Enviado pelo servidor */);
});
