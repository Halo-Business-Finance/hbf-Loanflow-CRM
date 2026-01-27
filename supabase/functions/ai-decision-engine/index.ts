import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SecureLogger } from '../_shared/secure-logger.ts';

const logger = new SecureLogger('ai-decision-engine');

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LoanApplication {
  name?: string;
  business_name?: string;
  loan_amount?: number;
  loan_type?: string;
  credit_score?: number;
  income?: number;
  debt_to_income_ratio?: number;
  years_in_business?: number;
  collateral_value?: number;
  purpose_of_loan?: string;
  annual_revenue?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { application, lenderGuidelines } = await req.json() as { 
      application: LoanApplication;
      lenderGuidelines?: string;
    };
    
    logger.info('Processing loan decision request', { loanType: application.loan_type });
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert loan underwriting decision engine. Analyze loan applications against standard lending guidelines and provide a recommendation.

Standard SBA/Commercial Lending Guidelines:
- Minimum credit score: 640 (680+ preferred for SBA)
- Maximum DTI: 43% (36% preferred)
- Minimum years in business: 2 years (SBA 7a), 1 year (microloans)
- Collateral coverage: 100%+ of loan amount preferred
- Annual revenue should support debt service (DSCR > 1.25)

${lenderGuidelines ? `Additional Lender-Specific Guidelines:\n${lenderGuidelines}` : ''}

Provide a detailed analysis with:
1. Clear recommendation (Approve, Conditional Approve, Decline)
2. Key factors supporting the decision
3. Risk factors identified
4. Conditions for approval if applicable
5. Confidence score (0-100%)`;

    const userPrompt = `Analyze this loan application and provide an underwriting decision:

Applicant: ${application.name || 'N/A'}
Business: ${application.business_name || 'N/A'}
Loan Amount Requested: $${application.loan_amount?.toLocaleString() || 'N/A'}
Loan Type: ${application.loan_type || 'N/A'}
Credit Score: ${application.credit_score || 'N/A'}
Annual Income: $${application.income?.toLocaleString() || 'N/A'}
Debt-to-Income Ratio: ${application.debt_to_income_ratio ? `${application.debt_to_income_ratio}%` : 'N/A'}
Years in Business: ${application.years_in_business || 'N/A'}
Collateral Value: $${application.collateral_value?.toLocaleString() || 'N/A'}
Annual Revenue: $${application.annual_revenue?.toLocaleString() || 'N/A'}
Purpose: ${application.purpose_of_loan || 'N/A'}

Provide your underwriting decision and analysis.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_decision",
              description: "Provide underwriting decision for the loan application",
              parameters: {
                type: "object",
                properties: {
                  recommendation: {
                    type: "string",
                    enum: ["Approve", "Conditional Approve", "Decline"],
                    description: "The underwriting recommendation"
                  },
                  confidenceScore: {
                    type: "number",
                    description: "Confidence in the decision (0-100)"
                  },
                  summary: {
                    type: "string",
                    description: "Brief summary of the decision rationale"
                  },
                  positiveFactors: {
                    type: "array",
                    items: { type: "string" },
                    description: "Factors supporting approval"
                  },
                  riskFactors: {
                    type: "array",
                    items: { type: "string" },
                    description: "Risk factors identified"
                  },
                  conditions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        condition: { type: "string" },
                        priority: { type: "string", enum: ["Required", "Recommended"] }
                      },
                      required: ["condition", "priority"]
                    },
                    description: "Conditions for approval"
                  },
                  creditAnalysis: {
                    type: "object",
                    properties: {
                      score: { type: "string", enum: ["Excellent", "Good", "Fair", "Poor"] },
                      notes: { type: "string" }
                    }
                  },
                  debtAnalysis: {
                    type: "object",
                    properties: {
                      status: { type: "string", enum: ["Within Guidelines", "Borderline", "Exceeds Guidelines"] },
                      notes: { type: "string" }
                    }
                  },
                  collateralAnalysis: {
                    type: "object",
                    properties: {
                      coverage: { type: "string", enum: ["Fully Secured", "Partially Secured", "Unsecured"] },
                      ltv: { type: "number" },
                      notes: { type: "string" }
                    }
                  }
                },
                required: ["recommendation", "confidenceScore", "summary", "positiveFactors", "riskFactors"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "provide_decision" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      logger.error('AI gateway error', new Error(errorText), { status: response.status });
      return new Response(
        JSON.stringify({ error: "Failed to generate decision" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const decision = JSON.parse(toolCall.function.arguments);
      logger.info('Decision generated successfully', { recommendation: decision.recommendation });
      return new Response(
        JSON.stringify(decision),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Failed to parse decision" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    logger.error('Error in decision engine', error instanceof Error ? error : new Error(String(error)));
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
