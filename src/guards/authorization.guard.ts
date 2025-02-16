import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from 'src/auth/auth.service';
import { PERMISSIONS_KEY } from 'src/decorators/permissions.decorator';
import { Permission } from 'src/roles/dtos/role.dto';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(private reflector: Reflector, private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Step 1: Check if userId is present (set by AuthenticationGuard)
    if (!request.userId) {
      throw new UnauthorizedException('User Id not found');
    }

    // Step 2: Check if the user is banned
    const isBanned = await this.authService.isUserBanned(request.userId);
    if (isBanned) {
      throw new ForbiddenException('You are banned from accessing this resource');
    }

    // Step 3: Retrieve route permissions
    const routePermissions: Permission[] = this.reflector.getAllAndOverride(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!routePermissions) {
      return true; // No permissions required; allow access
    }

    // Step 4: Verify user permissions
    try {
      const userPermissions = await this.authService.getUserPermissions(
        request.userId,
      );

      for (const routePermission of routePermissions) {
        const userPermission = userPermissions.find(
          (perm) => perm.resource === routePermission.resource,
        );

        if (!userPermission) {
          throw new ForbiddenException('Insufficient permissions');
        }

        const allActionsAvailable = routePermission.actions.every(
          (requiredAction) => userPermission.actions.includes(requiredAction),
        );

        if (!allActionsAvailable) {
          throw new ForbiddenException('Insufficient permissions');
        }
      }
    } catch (e) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
