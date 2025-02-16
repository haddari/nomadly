import {
  BadRequestException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SignupDto } from './dtos/signup.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '../user/entities/user.schema';
import mongoose, { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dtos/login.dto';
import { JwtService } from '@nestjs/jwt';
import { RefreshToken } from './schemas/refresh-token.schema';
import { v4 as uuidv4 } from 'uuid';
import { nanoid } from 'nanoid';
import { ResetToken } from './schemas/reset-token.schema';
import { MailService } from 'src/services/mail.service';
import { RolesService } from 'src/roles/roles.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private UserModel: Model<User>,
    @InjectModel(RefreshToken.name)
    private RefreshTokenModel: Model<RefreshToken>,
    @InjectModel(ResetToken.name)
    private ResetTokenModel: Model<ResetToken>,
    private jwtService: JwtService,
    private mailService: MailService,
    private rolesService: RolesService,
  ) {}

  async signup(signupData: SignupDto) {
    const { email, password, name, permi } = signupData;
  
    // Check if email is in use
    const emailInUse = await this.UserModel.findOne({ email });
    if (emailInUse) {
      throw new BadRequestException('Email already in use');
    }
  
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
  
    // Create user document and save in MongoDB
    const createdUser = await this.UserModel.create({
      
      name,
      email,
      password: hashedPassword,
      permi,
    });
  
    // Return the response with statusCode and user information
    return {
      statusCode: HttpStatus.OK,
      data: createdUser,
    };
  }


  async login(credentials: LoginDto) {
    const { email, password } = credentials;
  
    // Trouver l'utilisateur par email dans la base de données
    const user = await this.UserModel.findOne({ email });
    if (!user) {
        throw new UnauthorizedException('Wrong credentials');
    }
  
    // Comparer le mot de passe entré avec le mot de passe stocké dans la base de données
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
        throw new UnauthorizedException('Wrong credentials');
    }
  
    // Générer les tokens JWT
    const tokens = await this.generateUserTokens(user._id);
  
    // Retourner la réponse avec le message de succès, le statusCode, et les tokens
    return {
      statusCode: HttpStatus.OK,
      userId: user._id,
      name: user.name,
      ...tokens,
    };
  
}


  async changePassword(userId, oldPassword: string, newPassword: string) {
    //Find the user
    const user = await this.UserModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found...');
    }

    //Compare the old password with the password in DB
    const passwordMatch = await bcrypt.compare(oldPassword, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Wrong credentials');
    }

    //Change user's password
    const newHashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = newHashedPassword;
    await user.save();
  }
  async updateProfile(
    userId: string,
    email: string,
    name: string,
  ) {
    // Find the user by ID (use userId from the authentication token)
    const user = await this.UserModel.findById(userId);
  
    if (!user) {
      throw new BadRequestException('User not found');
    }
  
    // Check if the new email is already in use by another user
    if (email && email !== user.email) {
      const emailExists = await this.UserModel.findOne({ email });
      if (emailExists) {
        throw new BadRequestException('Email is already in use');
      }
      user.email = email;
    }
  
    // Update the name if provided
    if (name) {
      user.name = name;
    }
  
    // Save the updated user details
    await user.save();
  
    // Return the updated user object or success message
    return {
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }
  
  async forgotPassword(email: string) {
    //Check that user exists
    const user = await this.UserModel.findOne({ email });

    if (user) {
      //If user exists, generate password reset link
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + 1);

      const resetToken = nanoid(64);
      await this.ResetTokenModel.create({
        token: resetToken,
        userId: user._id,
        expiryDate,
      });
      //Send the link to the user by email
      this.mailService.sendPasswordResetEmail(email, resetToken);
    }

    return { message: 'If this user exists, they will receive an email' };
  }

  async resetPassword(newPassword: string, resetToken: string) {
    //Find a valid reset token document
    const token = await this.ResetTokenModel.findOneAndDelete({
      token: resetToken,
      expiryDate: { $gte: new Date() },
    });

    if (!token) {
      throw new UnauthorizedException('Invalid link');
    }

    //Change user password (MAKE SURE TO HASH!!)
    const user = await this.UserModel.findById(token.userId);
    if (!user) {
      throw new InternalServerErrorException();
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
  }

  async refreshTokens(refreshToken: string) {
    const token = await this.RefreshTokenModel.findOne({
      token: refreshToken,
      expiryDate: { $gte: new Date() },
    });

    if (!token) {
      throw new UnauthorizedException('Refresh Token is invalid');
    }
    return this.generateUserTokens(token.userId);
  }

  async generateUserTokens(userId) {
    const accessToken = this.jwtService.sign({ userId }, { expiresIn: '10h' });
    const refreshToken = uuidv4();

    await this.storeRefreshToken(refreshToken, userId);
    return {
      accessToken,
      refreshToken,
    };
  }

  async storeRefreshToken(token: string, userId: string) {
    // Calculate expiry date 3 days from now
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 3);

    await this.RefreshTokenModel.updateOne(
      { userId },
      { $set: { expiryDate, token } },
      {
        upsert: true,
      },
    );
  }

  async getUserPermissions(userId: string) {
    const user = await this.UserModel.findById(userId);

    if (!user) throw new BadRequestException();

    const role = await this.rolesService.getRoleById(user.roleId.toString());
    return role.permissions;
  }
  async loginGoogle(credentials: LoginDto) {

    const { email, password } = credentials;

    // Find if user exists by email
    const user = await this.UserModel.findOne({ email });
    if (!user) {
      throw new UnauthorizedException('Wrong credentials');
    }

    // Compare entered password with existing password
    const passwordMatch = password == user.password;
    if (!passwordMatch) {
      throw new UnauthorizedException('Wrong credentials this erorr ids from our');
    }

    // Generate JWT tokens
    const tokens = await this.generateUserTokens(user._id);

    // Return response with statusCode and user information
    return {
      statusCode: HttpStatus.OK,
      userId: user._id,
      //userName: user.name,
      //userEmail: user.email,
      //userPassword: user.password,

      ...tokens,
    };
  }
  async findUserById(userId: string) {
    // Validate the ID format before querying the database
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException('Invalid user ID format');
    }

    const user = await this.UserModel.findById(userId).exec();

    if (!user) {

      return user

    }

    return user;
  }
  async findUserByEmail(email: string): Promise<User | null> {
    return this.UserModel.findOne({ email }).exec();
  }
  async findOrCreateUser(profile: any) {
    const email = profile.emails[0].value;
    const name = profile.displayName;
    const permi = profile.displayName;
    // Check if the user already exists
    let user = await this.findUserByEmail(email);
    if (!user) {
      // If user doesn't exist, create a new one with a placeholder password
      const newUser: SignupDto = {
        email,
        name,
        permi,
        password: '', // Leave main password empty as it's handled by Google
      };
      const signupResult = await this.signup(newUser);
      user = signupResult.data; // Access the created user directly from the signup result

    }

    return user;
  }
  async isUserBanned(userId: string): Promise<boolean> {
    const user = await this.UserModel.findById(userId);
    return user?.banned ?? false;
  }

}
