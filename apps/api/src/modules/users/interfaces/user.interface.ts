export interface UserEntity {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  passwordHash: string;
  refreshTokenHash?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
