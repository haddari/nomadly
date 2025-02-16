import { GoogleGenerativeAI } from '@google/generative-ai';
import { Injectable } from '@nestjs/common';

interface ChatSession {
  history: string[];
  lastUpdated: Date;
}

@Injectable()
export class OpenaitryService {
    private genAI: GoogleGenerativeAI;
    private chatSessions: Map<string, ChatSession> = new Map();
    private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

    constructor() {
      this.genAI = new GoogleGenerativeAI("add your API KEY ");
    }

    private cleanupOldSessions() {
      const now = new Date();
      for (const [sessionId, session] of this.chatSessions.entries()) {
        if (now.getTime() - session.lastUpdated.getTime() > this.SESSION_TIMEOUT) {
          this.chatSessions.delete(sessionId);
        }
      }
    }

    async getResponse(query: string, sessionId: string = 'default'): Promise<string> {
      try {
        this.cleanupOldSessions();

        // Get or create session
        if (!this.chatSessions.has(sessionId)) {
          this.chatSessions.set(sessionId, {
            history: [],
            lastUpdated: new Date()
          });
        }

        const session = this.chatSessions.get(sessionId)!;
        
        // Build conversation context with clear instructions
        const context = `You are a helpful travel assistant. Treat all questions in the context of travel and the ongoing conversation.
                        Consider the following as travel-related:
                        - Questions about budgets and costs in specific destinations
                        - Questions about duration of stays
                        - Follow-up questions about previously mentioned destinations
                        - Questions about planning and itineraries
                        - Questions about accommodation, food, and transportation

                        Previous conversation:
                        ${session.history.join('\n')}

                        Current question: ${query}

                        If this is a follow-up question about a previously mentioned destination or travel plan, 
                        consider it travel-related and provide a helpful response.
                        Only respond with "I'm here to help with travel questions only!" if the question is completely
                        unrelated to travel or previous travel discussions.`;

        const model = this.genAI.getGenerativeModel({ 
          model: 'gemini-pro',
          generationConfig: {
            temperature: 0.7,
            topP: 0.8,
            topK: 40,
          },
        });

        const result = await model.generateContent(context);
        const response = result.response.text();

        // Update session history with clear labeling of turns
        session.history.push(`User asked: ${query}`);
        session.history.push(`Travel Assistant replied: ${response}`);
        session.lastUpdated = new Date();

        // Keep last 10 exchanges to prevent context from getting too large
        if (session.history.length > 20) {
          session.history = session.history.slice(-20);
        }

        return response;
      } catch (error) {
        console.error('Error:', error);
        return 'Sorry, I could not process your request.';
      }
    }

    clearSession(sessionId: string): void {
      this.chatSessions.delete(sessionId);
    }
}