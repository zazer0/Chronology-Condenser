/** Given a 2D array storing each document's page strings, *
  * Summarises each document as a chronology, and then
  * i.e - docs[pages[]]
  */
import * as wmill from "windmill-client"
import OpenAI from 'openai';
import { AxAI, AxAIAnthropicConfig, AxAIAnthropicModel, AxAIOpenAIModel, AxChainOfThought } from '@ax-llm/ax';


export async function main(documentArray: List) {

  const openai_apikey = (await wmill.getVariable('u/admin2/openai_windmill_codegen'))
  const ant_apikey = (await wmill.getVariable('u/admin2/anthropic_apikey'))

  const client = new OpenAI({
    apiKey: openai_apikey,
  });

  // LLM Call to organise the documents (use cheaper model as it's a basic task)
  const createChatCompletion = async (thisDocPages: any) => {
    const oneDocPages = JSON.stringify(thisDocPages);
    const chatCompletion = await client.chat.completions.create({
      messages: [
        {
          // Wrote this prompt, then realised the task wasn't actually asking me to create a chronology!
          role: 'system',
          content: 'You are an expert at creating legal chronologies; specialising in summarising multiple document overviews into a cohesive timeline that a lawyer can skim.' +
            'Your task is to reorganise the given documents into date order; summarising each so that a senior lawyer can easily write a chronology timeline from your notes.',
        },
        { role: 'user', content: `Documents: ${oneDocPages}` },
      ],
      model: 'gpt-4o-mini', // ran out of time to get code working with a cheaper model! (but, easy to do)
    });
    return chatCompletion.choices[0].message.content;
  };

  // Runs above prompt simultaneously on each document's pageArray - collects responses back into a summary array
  const docSummaries = await Promise.all(documentArray.map(createChatCompletion));

  console.log("Document Summaries:", docSummaries)

  // Formatting as XML for Anthropic model
  const documentsToSummarise = docSummaries
    .map((summary: any, index: number) => `Document ${index + 1}:\n${summary}`)
    .join('\n\n');


  const anthropicConfig: Partial<AxAIAnthropicConfig> = {
    model: AxAIAnthropicModel.Claude35Sonnet, 
    maxTokens: 4096 // Had to increase to avoid context ceiling
  };

  const antAI = new AxAI({
    name: 'anthropic',
    apiKey: ant_apikey,
    config: anthropicConfig
  });

  // Ran out of time to integrate a system prompt with this library!
  // const antPrompt = 'You are an expert at creating legal chronologies; specialising in summarising a verbose timeline cohesively for a senior partner to easily skim.'
  // ai.addChatMessage({ role: 'system', content: antPrompt });

  const cotSummary = new AxChainOfThought(
    antAI,
    `documentsToSummarise -> succinctYetFullChronologicalSummary "summarise overall document contents; 2-3 sentences"`
  );

  const cotMetadata = new AxChainOfThought(
    openAI,
    `documentsToSummarise -> dateRange "range of the documents", documentTypes "forms spanned; succinct comma separated list"`
  );

  // Runs both CoT's in parallel
  const [summary, metadata] = await Promise.all([
    cotSummary.forward({ documentsToSummarise }),
    cotMetadata.forward({ documentsToSummarise })
  ]);

  // delete metadata['reason']

  console.log('>', summary.reason);
  console.log('>', metadata);

  return { 'summary': summary.succinctYetFullChronologicalSummary, 'metadata': metadata }

}
