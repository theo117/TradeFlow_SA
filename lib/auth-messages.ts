// Public messages are selected by code, never echoed from Auth.js/DB exceptions
// or arbitrary query-string text. This module is also safe for the client form.
export function loginErrorMessage(code?: string) {
  if (code === "too_many_attempts") return "Too many login attempts. Please wait 15 minutes and try again.";
  if (code === "email_not_verified") return "Please verify your email before logging in. You can request a new verification email below.";
  if (code === "credentials" || code === "CredentialsSignin") return "The email or password does not match. Please check your password and try again.";
  return code ? "Unable to log in. Please try again." : undefined;
}
export function recoveryErrorMessage(code?: string) {
  if (code === "invalid_email") return "Please enter a valid email address.";
  if (code === "invalid_token") return "This link is invalid, expired, or already used. Please request a new one.";
  if (code === "invalid_password") return "Please enter a new password with at least 10 characters.";
  if (code === "too_many_attempts") return "Too many attempts. Please wait 15 minutes and try again.";
  return code ? "Unable to complete this request. Please try again." : undefined;
}
export function loginSuccessMessage(code?: string) {
  if (code === "password_reset") return "Password updated. You can log in with your new password once your email is verified.";
  if (code === "email_verified") return "Email verified. You can log in now.";
  return undefined;
}
