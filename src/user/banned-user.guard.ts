import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtService } from '@nestjs/jwt';  // Import JwtService

@Injectable()
export class BannedUserGuard implements CanActivate {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService, // Inject JwtService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is missing');
    }

    const token = authHeader.split(' ')[1]; // Extract the token (Bearer <token>)
    if (!token) {
      throw new UnauthorizedException('Token not found');
    }

    try {
      // Verify and decode the token using JwtService
      const decoded: any = this.jwtService.verify(token, { secret: 'SECRET_KEY' }); // Replace with your actual JWT secret

      const userId = decoded.sub; // Assuming 'sub' contains the user ID
      if (!userId) {
        throw new ForbiddenException('Invalid token payload');
      }

      // Check if the user is banned
      const isBanned = await this.userService.isUserBanned(userId);
      if (isBanned) {
        throw new ForbiddenException('You are banned from accessing this resource');
      }

      // Attach user data to request for further use
      request.user = { id: userId, email: decoded.email };
      return true;
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
