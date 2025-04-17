export const outputLabels = {
  convexCodegen: 'ConvexCodegen',
  convexTypecheck: 'ConvexTypecheck',
  frontendTypecheck: 'FrontendTypecheck',
  convexLint: 'ConvexLint',
  convexDeploy: 'ConvexDeploy',
} as const;
export type OutputLabels = (typeof outputLabels)[keyof typeof outputLabels];
