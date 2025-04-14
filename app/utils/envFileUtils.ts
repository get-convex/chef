export const appendEnvVarIfNotSet = async (args: {
  envFilePath: string;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  envVarName: string;
  value: string;
}) => {
  const { envFilePath, readFile, writeFile, envVarName, value } = args;
  const envVarLine = `${envVarName}=${value}\n`;

  let content: string | null = null;
  try {
    content = await readFile(envFilePath);
  } catch (err: any) {
    if (!err.toString().includes('ENOENT')) {
      throw err;
    }
  }
  if (content === null) {
    // Create the file if it doesn't exist
    await writeFile(envFilePath, envVarLine);
  } else {
    const lines = content.split('\n');

    // Check if the env var already exists
    const envVarExists = lines.some((line) => line.startsWith(`${envVarName}=`));

    if (!envVarExists) {
      // Add the env var to the end of the file
      const newContent = content.endsWith('\n') ? `${content}${envVarLine}` : `${content}\n${envVarLine}`;
      await writeFile(envFilePath, newContent);
    }
  }
};
