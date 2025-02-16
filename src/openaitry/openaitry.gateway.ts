import {
    SubscribeMessage,
    WebSocketGateway,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    WebSocketServer,
  } from '@nestjs/websockets';
  import { Server, Socket } from 'socket.io';
  import { OpenaitryService } from './openaitry.service';
  
  @WebSocketGateway({
    cors: {
      origin: '*', // Allow all origins for testing
      methods: ['GET', 'POST'],
    },
  })
  export class OpenaitryGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
  
    constructor(private readonly openaiService: OpenaitryService) {}
  
    afterInit(server: Server) {
      console.log('WebSocket Initialized');
    }
  
    handleConnection(client: Socket) {
      console.log(`Client connected: ${client.id}`);
    }
  
    handleDisconnect(client: Socket) {
      console.log(`Client disconnected: ${client.id}`);
    }
  
    @SubscribeMessage('askQuestion')
async handleMessage(client: Socket, payload: { question: string }) {
  try {
    const answer = await this.openaiService.getResponse(payload.question);
    client.emit('botResponse', { response: answer });
  } catch (error) {
    console.error('Error processing question:', error);
    client.emit('botResponse', { response: 'Sorry, something went wrong!' });
  }
}
  }
  