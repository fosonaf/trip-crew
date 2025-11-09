const { io } = require('socket.io-client');

const config = {
  url: 'http://localhost:5000',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImlhdCI6MTc2MjcxNjcxNiwiZXhwIjoxNzYzMzIxNTE2fQ.Mr6mJQ4UDbrJ4hfNcH7WOM3dgBM0b02HpVJMjlan3Cw',
  eventId: 1
};

console.log('Connexion à', config.url);
const socket = io(config.url, {
  auth: {
    token: config.token
  },
  transports: ['websocket'], // Force WebSocket uniquement
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

socket.on('connect', () => {
  console.log('✅ Connecté au serveur Socket.IO');
  console.log('ID de socket:', socket.id);
  
  // Rejoindre l'événement
  socket.emit('join_event', config.eventId, (response) => {
    if (response && response.error) {
      console.error('Erreur lors de la connexion:', response.error);
      return;
    }
    console.log(`✅ Rejoint l'événement ${config.eventId}`);
    console.log('\nTapez un message et appuyez sur Entrée pour envoyer');
    console.log('ou "exit" pour quitter');
  });
});

socket.on('connect_error', (error) => {
  console.error('❌ Erreur de connexion:', error.message);
  console.error('Détails:', error);
});

socket.on('disconnect', (reason) => {
  console.log('Déconnecté:', reason);
});

socket.on('new_message', (message) => {
  console.log('\n📨 Nouveau message:');
  console.log('De:', message.user.firstName, message.user.lastName);
  console.log('Contenu:', message.content);
  console.log('À:', new Date(message.createdAt).toLocaleString());
  console.log('\n> ');
});

// Gestion de la saisie utilisateur
process.stdin.setEncoding('utf8');
process.stdin.on('data', (data) => {
  const input = data.trim();
  
  if (input.toLowerCase() === 'exit') {
    socket.disconnect();
    process.exit(0);
  } else if (input) {
    socket.emit('send_message', {
      eventId: config.eventId,
      content: input
    });
  }
});

// Gestion de la fermeture
process.on('SIGINT', () => {
  console.log('\nDéconnexion...');
  socket.disconnect();
  process.exit(0);
});