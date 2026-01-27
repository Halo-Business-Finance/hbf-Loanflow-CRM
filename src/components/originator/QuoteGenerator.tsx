import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Calculator, 
  DollarSign, 
  Percent, 
  Clock,
  CheckCircle,
  Building2,
  FileText,
  Copy,
  Send
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { formatNumberWithCommas, parseNumberFromFormatted } from '@/lib/utils';

interface LoanQuote {
  lender: string;
  loanType: string;
  rate: number;
  term: number;
  monthlyPayment: number;
  totalInterest: number;
  totalPayment: number;
  fees: number;
  apr: number;
  highlights: string[];
}

interface QuoteGeneratorProps {
  borrowerName?: string;
  borrowerEmail?: string;
}

const lenderRates = [
  { name: 'Wells Fargo SBA', baseRate: 7.5, maxLTV: 85, minCreditScore: 680, terms: [10, 15, 25] },
  { name: 'Chase Commercial', baseRate: 7.75, maxLTV: 80, minCreditScore: 700, terms: [5, 10, 15] },
  { name: 'Bank of America', baseRate: 7.25, maxLTV: 90, minCreditScore: 660, terms: [10, 20, 25] },
  { name: 'US Bank SBA', baseRate: 7.0, maxLTV: 85, minCreditScore: 650, terms: [7, 10, 25] },
  { name: 'Regions Bank', baseRate: 8.0, maxLTV: 75, minCreditScore: 620, terms: [5, 10, 15] },
];

export function QuoteGenerator({ borrowerName, borrowerEmail }: QuoteGeneratorProps) {
  const [loanAmount, setLoanAmount] = useState<string>('500000');
  const [loanType, setLoanType] = useState<string>('sba_7a');
  const [creditScore, setCreditScore] = useState<string>('720');
  const [propertyValue, setPropertyValue] = useState<string>('650000');
  const [quotes, setQuotes] = useState<LoanQuote[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const calculateMonthlyPayment = (principal: number, annualRate: number, termYears: number): number => {
    const monthlyRate = annualRate / 100 / 12;
    const numPayments = termYears * 12;
    return (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
           (Math.pow(1 + monthlyRate, numPayments) - 1);
  };

  const generateQuotes = () => {
    setIsGenerating(true);
    
    const amount = parseFloat(loanAmount) || 0;
    const credit = parseInt(creditScore) || 0;
    const property = parseFloat(propertyValue) || 0;
    const ltv = (amount / property) * 100;

    setTimeout(() => {
      const generatedQuotes: LoanQuote[] = lenderRates
        .filter(lender => credit >= lender.minCreditScore && ltv <= lender.maxLTV)
        .map(lender => {
          // Adjust rate based on credit score
          let adjustedRate = lender.baseRate;
          if (credit >= 750) adjustedRate -= 0.25;
          else if (credit >= 700) adjustedRate -= 0.125;
          else if (credit < 680) adjustedRate += 0.25;

          // Adjust for LTV
          if (ltv > 80) adjustedRate += 0.125;
          if (ltv < 70) adjustedRate -= 0.125;

          const preferredTerm = lender.terms[Math.floor(lender.terms.length / 2)];
          const monthlyPayment = calculateMonthlyPayment(amount, adjustedRate, preferredTerm);
          const totalPayment = monthlyPayment * preferredTerm * 12;
          const totalInterest = totalPayment - amount;
          const fees = amount * 0.02; // 2% origination fee estimate
          const apr = adjustedRate + (fees / amount / preferredTerm) * 100;

          const highlights: string[] = [];
          if (adjustedRate <= 7.25) highlights.push('Competitive Rate');
          if (lender.maxLTV >= 85) highlights.push('High LTV Available');
          if (lender.minCreditScore <= 660) highlights.push('Flexible Credit');
          if (preferredTerm >= 20) highlights.push('Long Term Available');

          return {
            lender: lender.name,
            loanType: loanType === 'sba_7a' ? 'SBA 7(a)' : loanType === 'sba_504' ? 'SBA 504' : 'Commercial',
            rate: adjustedRate,
            term: preferredTerm,
            monthlyPayment,
            totalInterest,
            totalPayment,
            fees,
            apr,
            highlights
          };
        })
        .sort((a, b) => a.rate - b.rate);

      setQuotes(generatedQuotes);
      setIsGenerating(false);
      
      if (generatedQuotes.length === 0) {
        toast.error('No quotes available', {
          description: 'Try adjusting loan amount, credit score, or property value'
        });
      } else {
        toast.success(`Generated ${generatedQuotes.length} loan quotes`);
      }
    }, 1500);
  };

  const copyQuote = (quote: LoanQuote) => {
    const text = `
Loan Quote - ${quote.lender}
Loan Type: ${quote.loanType}
Amount: $${parseFloat(loanAmount).toLocaleString()}
Rate: ${quote.rate.toFixed(2)}%
Term: ${quote.term} years
Monthly Payment: $${quote.monthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
Total Interest: $${quote.totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}
Est. Fees: $${quote.fees.toLocaleString(undefined, { maximumFractionDigits: 0 })}
APR: ${quote.apr.toFixed(2)}%
    `.trim();
    
    navigator.clipboard.writeText(text);
    toast.success('Quote copied to clipboard');
  };

  const sendQuote = (quote: LoanQuote) => {
    toast.success('Quote sent to borrower', {
      description: `Email sent to ${borrowerEmail || 'borrower'}`
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          Loan Quote Generator
        </CardTitle>
        <CardDescription>
          Generate instant loan quotes with rate comparisons
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Form */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="loanAmount">Loan Amount</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="loanAmount"
                type="text"
                value={formatNumberWithCommas(loanAmount)}
                onChange={(e) => {
                  const parsed = parseNumberFromFormatted(e.target.value);
                  setLoanAmount(parsed);
                }}
                className="pl-9"
                placeholder="500,000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="propertyValue">Property Value</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="propertyValue"
                type="text"
                value={formatNumberWithCommas(propertyValue)}
                onChange={(e) => {
                  const parsed = parseNumberFromFormatted(e.target.value);
                  setPropertyValue(parsed);
                }}
                className="pl-9"
                placeholder="650,000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="creditScore">Credit Score</Label>
            <Input
              id="creditScore"
              type="number"
              value={creditScore}
              onChange={(e) => setCreditScore(e.target.value)}
              placeholder="720"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="loanType">Loan Type</Label>
            <Select value={loanType} onValueChange={setLoanType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sba_7a">SBA 7(a)</SelectItem>
                <SelectItem value="sba_504">SBA 504</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
                <SelectItem value="equipment">Equipment</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={generateQuotes} disabled={isGenerating}>
          {isGenerating ? (
            <>Generating Quotes...</>
          ) : (
            <>
              <Calculator className="mr-2 h-4 w-4" />
              Generate Quotes
            </>
          )}
        </Button>

        {/* Quotes Display */}
        {quotes.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Available Quotes ({quotes.length})
            </h4>
            
            <div className="grid gap-4">
              {quotes.map((quote, index) => (
                <div 
                  key={index}
                  className={`p-4 border rounded-lg ${
                    index === 0 ? 'border-green-500 bg-green-500/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{quote.lender}</span>
                        {index === 0 && (
                          <Badge variant="default" className="bg-green-500">Best Rate</Badge>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">{quote.loanType}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">{quote.rate.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">APR: {quote.apr.toFixed(2)}%</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mb-3 text-sm">
                    <div>
                      <div className="text-muted-foreground">Term</div>
                      <div className="font-medium">{quote.term} years</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Monthly</div>
                      <div className="font-medium">
                        ${quote.monthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Total Interest</div>
                      <div className="font-medium">
                        ${quote.totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Est. Fees</div>
                      <div className="font-medium">
                        ${quote.fees.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>

                  {quote.highlights.length > 0 && (
                    <div className="flex gap-2 mb-3">
                      {quote.highlights.map((highlight, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {highlight}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => copyQuote(quote)}>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                    <Button size="sm" onClick={() => sendQuote(quote)}>
                      <Send className="h-3 w-3 mr-1" />
                      Send to Borrower
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
