import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import eventRoutes from './routes/eventRoutes';
import memberRoutes from './routes/memberRoutes';
import stepRoutes from './routes/stepRoutes';
import messageRoutes from './routes/messageRoutes';
import checkinRoutes from './routes/checkinRoutes';
import { errorHandler, notFound } from './middleware/errorHandler';
import { setupChatSocket } from './sockets/chatSocket';
import { startNotificationScheduler } from './services/notificationService';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.engine.on("connection_error", (err) => {
  console.log(err.req);
  console.log(err.code);
  console.log(err.message);
  console.log(err.context);
});

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Trip Crew API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/events', memberRoutes);
app.use('/api/events', stepRoutes);
app.use('/api/events', messageRoutes);
app.use('/api', checkinRoutes);

app.use(notFound);
app.use(errorHandler);

setupChatSocket(io);
startNotificationScheduler(io);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`API: http://localhost:${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}`);
});