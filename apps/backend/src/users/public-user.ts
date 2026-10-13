// Perfil público del usuario — nunca incluye passwordHash. Vive en Users
// (dueño de la entidad User); Auth lo usa para armar la sesión.
export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  emailVerified: boolean;
  status: string;
  createdAt: Date;
}

export function toPublicUser(user: {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  emailVerified: boolean;
  status: string;
  createdAt: Date;
}): PublicUser {
  const {
    id,
    firstName,
    lastName,
    username,
    email,
    emailVerified,
    status,
    createdAt,
  } = user;
  return {
    id,
    firstName,
    lastName,
    username,
    email,
    emailVerified,
    status,
    createdAt,
  };
}
