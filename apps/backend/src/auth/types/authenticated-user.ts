// Lo que JwtStrategy deja en req.user tras validar el access token.
export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
}
