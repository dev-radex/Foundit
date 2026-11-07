let user = null;
export function setUser(u) {
  user = u;
}
export async function getAuthenticatedUser() {
  return user;
}
