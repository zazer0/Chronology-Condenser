import * as wmill from "windmill-client"

import { AxAI, AxAIOpenAIModel, AxAITogether, AxChainOfThought } from '@ax-llm/ax';

class TwoStepSummary {
  private ai: AxAI;
  private cot0_metadata: AxChainOfThought;
  private cot1_overview: AxChainOfThought;
  private cot2_keypoints: AxChainOfThought;
  private cot3_final: AxChainOfThought;

  // Sets up chains-of-thought, so that cheap LLM's can be used
  constructor(ai: AxAI) {
    this.ai = ai;
    this.cot0_metadata = new AxChainOfThought(
      ai,
      `pageContent -> key_metadata "succinct list; including documentType, datePeriod"`
    );
    this.cot1_overview = new AxChainOfThought(
      ai,
      "pageContent -> full_yet_succinct_summary"
    );
    this.cot2_keypoints = new AxChainOfThought(
      ai,
      "pageContent -> key_legal_or_other_points"
    );
    this.cot3_final = new AxChainOfThought(
      ai,
      "key_metadata, comprehensive_bullet_summary, key_legal_or_other_points -> twosentence_keysummary"
    );
  }

  async forward(pageContent: string): Promise<string> {
    // Runs all 3 prompt chains simultaneously (using cheap LLM)
    const [metadata, initialSummary, keyPoints] = await Promise.all([ 
      this.cot0_metadata.forward({ pageContent }),
      this.cot1_overview.forward({ pageContent }),
      this.cot2_keypoints.forward({ pageContent })
    ]);

    // Then, uses outputs for final summary, with more expensive (but higher quality) LLM
    const finalSummary = await this.cot3_final.forward({
      key_metadata: metadata.key_metadata,
      comprehensive_bullet_summary: initialSummary.full_yet_succinct_summary,
      key_legal_or_other_points: keyPoints.key_legal_or_other_points,
    });

    return finalSummary.twosentence_keysummary;
  }
}

export async function main(
  pageString: string,
  pageConfidenceAverage: number,
  extra_metadata: object = {}
): Promise<string> {
  const ai = await setupAx();

  const predict = new TwoStepSummary(ai);

  const answer = await predict.forward(pageString);

  return answer;
}


// NB -> was keen to use cheaper, faster models
// Ultimately opted for 4o-mini for balance of speed/cost
async function setupAx(): Promise<AxAI> {
  const openai_apikey = (await wmill.getVariable('u/admin2/openai_wmcode_topup'))
  return new AxAI({
    name: 'openai',
    apiKey: openai_apikey,
    modelMap: {
      model: AxAIOpenAIModel.GPT4OMini
    }
  })

  // wayyy slower :( sadge
  // const oroute_apikey = (await wmill.getVariable('u/admin2/op-route_apikey'))
  // return new AxAI({
  //   name: 'openai',
  //   apiKey: oroute_apikey,
  //   apiURL: 'https://openrouter.ai/api/v1',
  //   modelMap: {
  //     model: 'meta-llama/llama-3-70b-instruct:nitro'
  //   }
  // })


  // good but SIGNIFICANT RATE LIMITING!
  // const tgt_apikey = (await wmill.getVariable('u/admin2/tgt_apikey'))
  // return new AxAI({
  //   name: 'together',
  //   apiKey: tgt_apikey,
  //   modelMap: {
  //     model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo'
  //   },
  //   max_tokens: 4000
  // });

}
