import { User } from 'src/user/user.model'; // Replace with your actual User entity/model path

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number; // Adjust based on what your JWT payload contains
        email?: string;
        [key: string]: any; // Allow additional properties if needed
      };
    }
  }
}
