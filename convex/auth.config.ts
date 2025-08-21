const clientId = process.env.WORKOS_CLIENT_ID;

export default {
  providers: [
    {
      type: "customJwt",
      issuer: `https://apiauth.convex.dev/user_management/${clientId}`,
      algorithm: "RS256",
      jwks: `https://apiauth.convex.dev/sso/jwks/${clientId}`,
      applicationID: clientId,
    },
  ],
};
