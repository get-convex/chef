export const outputLabels = {
  convexTypecheck: 'ConvexTypecheck',
  frontendTypecheck: 'FrontendTypecheck',
  convexDeploy: 'ConvexDeploy',
} as const;
export type OutputLabels = (typeof outputLabels)[keyof typeof outputLabels];
