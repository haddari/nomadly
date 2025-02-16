import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { BannedUserGuard } from './banned-user.guard';
import { AuthenticationGuard } from 'src/guards/authentication.guard';

@Controller('protected')
export class ProtectedController {
  @Get()
  @UseGuards(AuthenticationGuard, BannedUserGuard) // Apply the guard here
  getProtectedResource(@Req() request: any) {
    return { message: 'You have access to this resource.' };
  }
}