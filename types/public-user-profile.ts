export interface PublicUserProfile {
  id: number;
  name: string;
  email: string;
  image: string | null;
  createdAt: Date;
  avatarUrl: string | null;
  isGoogleLinked: boolean;
  hasPassword: boolean;
}
