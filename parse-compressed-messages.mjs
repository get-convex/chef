import fs from 'fs';
import * as lz4 from 'lz4-wasm-nodejs';

// Usage `node parse-compressed-messages.mjs <path-to-file> | jq`
// e.g. a file downloaded from the Chef backend containing message history

// Check if file path is provided
if (process.argv.length < 3) {
  console.error('Please provide a file path');
  process.exit(1);
}

const filePath = process.argv[2];

try {
  // Read the compressed file
  const compressedData = fs.readFileSync(filePath);

  // Decompress the data
  const decompressedBuffer = lz4.decompress(compressedData);

  // Parse the JSON
  const jsonData = JSON.parse(new TextDecoder().decode(decompressedBuffer));

  // Output the parsed JSON
  console.log(JSON.stringify(jsonData, null, 2));
} catch (error) {
  // Log the decompressed data in case it's useful
  console.log(new TextDecoder().decode(decompressedBuffer));
  console.error('Error processing file:', error.message);
  process.exit(1);
}
