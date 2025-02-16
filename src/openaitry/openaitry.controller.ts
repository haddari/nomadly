import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
import { OpenaitryService } from './openaitry.service';

@Controller('chatbot')
export class OpenaitryController {
    constructor(private openaitryService: OpenaitryService) {}

    @Get('ask')
    async ask(@Query('q') query: string, @Query('sessionId') sessionId: string = 'default') {
        if (!query) {
            throw new HttpException('Query parameter is required', HttpStatus.BAD_REQUEST);
        }

        try {
            const response = await this.openaitryService.getResponse(query, sessionId);
            return { response };
        } catch (error) {
            console.error('Error processing request:', error);
            throw new HttpException(
                'Internal server error',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('clear-session')
    async clearSession(@Query('sessionId') sessionId: string = 'default') {
        this.openaitryService.clearSession(sessionId);
        return { message: 'Session cleared successfully' };
    }
}