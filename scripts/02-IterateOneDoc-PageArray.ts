// there are multiple modes to add as header: //nobundling //native //npm //nodejs
// https://www.windmill.dev/docs/getting_started/scripts_quickstart/typescript#modes

// import { toWords } from "number-to-words@1"
import * as wmill from "windmill-client"
import { S3Object } from 'windmill-client';


// fill the type, or use the +Resource type to get a type-safe reference to a resource
// type Postgresql = object

type Page = {
  content: string;
  confidence: number;
}

// type DocJSON = {
//   content: Page[]
// }

export async function main(
  s3JsonPath: string,
) {

  const input_file: S3Object = { "s3": s3JsonPath }

  const file_content = await wmill.loadS3File(input_file);

  const decoder = new TextDecoder();
  const fileJson = JSON.parse(decoder.decode(file_content))

  // // Or load the file lazily as a Blob
  // let fileContentBlob = await wmill.loadS3FileStream(input_file);
  // console.log(await fileContentBlob.text());


  const docPages = fileJson // fmt: [ {text: XXX }, {text: XXX }, ... ]
  console.log(docPages)

  const pageStrings = docPages.map((page) => page.text);

  // const pageConfidenceTotals = docPages.reduce((total, page) => total + page.confidence, 0);

  return {
    pageStrings,
  }

  // return { foo: firstPage };
}
