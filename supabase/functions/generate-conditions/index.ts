import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SecureLogger } from '../_shared/secure-logger.ts';

const logger = new SecureLogger('generate-conditions');

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
  property_type?: string;
  purpose_of_loan?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { application } = await req.json() as { application: LoanApplication };
    
    logger.info('Generating conditions for loan application', { loanType: application.loan_type });
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert loan underwriter assistant. Based on the loan application data provided, generate appropriate underwriting conditions that would typically be required for loan approval.

Consider these factors:
- Credit score thresholds and requirements
- Income verification needs
- Debt-to-income ratio concerns
- Business history and financials
- Collateral requirements
- Documentation needs
- Regulatory compliance requirements

Generate conditions that are:
1. Specific and actionable
2. Categorized by type (Documentation, Financial, Property, Insurance, Legal, Prior-to-Funding)
3. Prioritized (Required, Recommended, Optional)
4. Include clear descriptions of what's needed

Format your response as a JSON array of condition objects.`;

    const userPrompt = `Generate underwriting conditions for this loan application:

Applicant: ${application.name || 'N/A'}
Business Name: ${application.business_name || 'N/A'}
Loan Amount: $${application.loan_amount?.toLocaleString() || 'N/A'}
Loan Type: ${application.loan_type || 'N/A'}
Credit Score: ${application.credit_score || 'N/A'}
Annual Income: $${application.income?.toLocaleString() || 'N/A'}
Debt-to-Income Ratio: ${application.debt_to_income_ratio ? `${application.debt_to_income_ratio}%` : 'N/A'}
Years in Business: ${application.years_in_business || 'N/A'}
Collateral Value: $${application.collateral_value?.toLocaleString() || 'N/A'}
Purpose of Loan: ${application.purpose_of_loan || 'N/A'}

Based on this information, generate appropriate underwriting conditions.`;

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
              name: "generate_conditions",
              description: "Generate a list of underwriting conditions for a loan application",
              parameters: {
                type: "object",
                properties: {
                  conditions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", description: "Unique identifier for the condition" },
                        category: { 
                          type: "string", 
                          enum: ["Documentation", "Financial", "Property", "Insurance", "Legal", "Prior-to-Funding"],
                          description: "Category of the condition"
                        },
                        title: { type: "string", description: "Brief title of the condition" },
                        description: { type: "string", description: "Detailed description of what is required" },
                        priority: { 
                          type: "string", 
                          enum: ["Required", "Recommended", "Optional"],
                          description: "Priority level of the condition"
                        },
                        dueDate: { type: "string", description: "Suggested due date or timeframe" },
                        responsibleParty: {
                          type: "string",
                          enum: ["Borrower", "Processor", "Underwriter", "Title Company", "Appraiser", "Insurance Agent"],
                          description: "Who is responsible for fulfilling this condition"
                        }
                      },
                      required: ["id", "category", "title", "description", "priority", "responsibleParty"],
                      additionalProperties: false
                    }
                  },
                  summary: {
                    type: "string",
                    description: "Brief summary of the overall risk assessment and key concerns"
                  },
                  riskLevel: {
                    type: "string",
                    enum: ["Low", "Medium", "High"],
                    description: "Overall risk level of the application"
                  }
                },
                required: ["conditions", "summary", "riskLevel"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_conditions" } }
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
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      logger.error('AI gateway error', new Error(errorText), { status: response.status });
      return new Response(
        JSON.stringify({ error: "Failed to generate conditions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const conditions = JSON.parse(toolCall.function.arguments);
      logger.info('Conditions generated successfully', { conditionCount: conditions.conditions?.length || 0 });
      return new Response(
        JSON.stringify(conditions),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Failed to parse conditions from AI response" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    logger.error('Error generating conditions', error instanceof Error ? error : new Error(String(error)));
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
