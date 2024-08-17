/** Script to save initial JSON, for easy retrieval **/
/* Note: asynchronous execution (no wait for user to add multiple jobs ) 
 *  and other API endpoint logic handled by Windmill natively */


import * as wmill from "windmill-client"
import { S3Object } from 'windmill-client';

export async function main(jsonData: any, s3_file_path?: string) {
  if (!s3_file_path) {
    const run_uuid = generate_uuid()
    s3_file_path = `default_out/${run_uuid}`;
  }

  const s3_file_output: S3Object = { s3: s3_file_path };
  const jsonString = JSON.stringify(jsonData);

  await wmill.writeS3File(s3_file_output, jsonString);

  return s3_file_output; // return saved file path, for easy use by next script
}

// Creates unique run UUID, based on run (and ordered by time)
function generate_uuid() {
  return `${process.env["WM_SCHEDULED_FOR"]}-${process.env["WM_OBJECT_PATH"].replaceAll('/', '_')}`;
}