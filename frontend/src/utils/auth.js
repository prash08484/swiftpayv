const TOKEN_KEY = "swiftpay_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (!token) return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getStoredUser() {
  const raw = localStorage.getItem("swiftpay_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (!user) {
    localStorage.removeItem("swiftpay_user");
    return;
  }
  localStorage.setItem("swiftpay_user", JSON.stringify(user));
}

export function clearStoredUser() {
  localStorage.removeItem("swiftpay_user");
}
