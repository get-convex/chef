// Using Google OAuth directly
const googleClientId = process.env.GOOGLE_CLIENT_ID || "561957498361-0f9mtcp25437nifbss26eei9a1b8rm6o.apps.googleusercontent.com";

export default {
  providers: [
    {
      type: "customJwt",
      issuer: "https://accounts.google.com",
      algorithm: "RS256",
      jwks: "https://www.googleapis.com/oauth2/v3/certs",
      applicationID: googleClientId,
    },
  ],
};
