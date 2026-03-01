// Using Convex OIDC provider with Google OAuth
const applicationId = process.env.CONVEX_APPLICATION_ID || "convex";

export default {
  providers: [
    {
      type: "customJwt",
      issuer: `https://auth.convex.dev`,
      algorithm: "RS256",
      jwks: `https://auth.convex.dev/.well-known/jwks.json`,
      applicationID: applicationId,
    },
  ],
};
