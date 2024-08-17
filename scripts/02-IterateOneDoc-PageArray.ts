import * as wmill from "windmill-client"
import { S3Object } from 'windmill-client';

type Page = {
  content: string;
  confidence: number;
}

export async function main(
  s3JsonPath: string,
) {

  const input_file: S3Object = { "s3": s3JsonPath }

  const file_content = await wmill.loadS3File(input_file);

  const decoder = new TextDecoder();
  const fileJson = JSON.parse(decoder.decode(file_content))

  const docPages = fileJson // fmt: [ {text: XXX }, {text: XXX }, ... ]

  const pageStrings = docPages.map((page) => page.text);
  return {
    pageStrings,
  }
}
