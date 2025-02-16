// user.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/user/entities/user.schema';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { ProtectedController } from './protected.controller';
import { BannedUserGuard } from './banned-user.guard';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  providers: [UserService,BannedUserGuard],
  controllers: [UserController,ProtectedController],
  exports: [MongooseModule], // Export the MongooseModule so it can be used by other modules
})
export class UserModule {}
