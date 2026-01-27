import { useState } from 'react';
import { Calculator, X, DollarSign, Percent, Calendar, TrendingUp, ToggleLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

export function LoanCalculator() {
  const [open, setOpen] = useState(false);
  const [loanAmount, setLoanAmount] = useState('0');
  const [interestRate, setInterestRate] = useState('0');
  const [loanTerm, setLoanTerm] = useState('0');
  const [termUnit, setTermUnit] = useState<'years' | 'months'>('years');
  const [isInterestOnly, setIsInterestOnly] = useState(false);
  const [interestOnlyPeriod, setInterestOnlyPeriod] = useState('0');
  const [interestOnlyUnit, setInterestOnlyUnit] = useState<'years' | 'months'>('years');

  const formatNumberWithCommas = (value: string): string => {
    // Remove all non-digit characters except decimal point
    const cleanValue = value.replace(/[^\d.]/g, '');
    if (!cleanValue) return '';
    
    // Split into integer and decimal parts
    const parts = cleanValue.split('.');
    // Add commas to integer part
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    
    return parts.join('.');
  };

  const parseNumberFromFormatted = (value: string): string => {
    // Remove commas for storage
    return value.replace(/,/g, '');
  };

  const calculatePayment = () => {
    const principal = parseFloat(loanAmount) || 0;
    const rate = (parseFloat(interestRate) || 0) / 100;
    const term = parseFloat(loanTerm) || 0;
    
    if (principal <= 0 || rate < 0 || term <= 0) {
      return { 
        monthly: 0, 
        total: 0, 
        totalInterest: 0,
        interestOnlyPayment: 0,
        principalAndInterestPayment: 0,
        interestOnlyTotal: 0
      };
    }

    // Convert term to months
    const totalMonths = termUnit === 'years' ? term * 12 : term;
    
    // Monthly interest rate
    const monthlyRate = rate / 12;
    
    if (isInterestOnly) {
      const ioPeriodMonths = interestOnlyUnit === 'years' 
        ? parseFloat(interestOnlyPeriod) * 12 
        : parseFloat(interestOnlyPeriod);
      
      // Interest-only payment (just the interest each month)
      const interestOnlyPayment = principal * monthlyRate;
      
      // Remaining months for principal + interest
      const remainingMonths = totalMonths - ioPeriodMonths;
      
      // Calculate principal + interest payment for remaining period
      let principalAndInterestPayment: number;
      if (monthlyRate === 0) {
        principalAndInterestPayment = principal / remainingMonths;
      } else if (remainingMonths <= 0) {
        // If interest-only period equals or exceeds total term
        principalAndInterestPayment = 0;
      } else {
        principalAndInterestPayment = 
          (principal * monthlyRate * Math.pow(1 + monthlyRate, remainingMonths)) /
          (Math.pow(1 + monthlyRate, remainingMonths) - 1);
      }
      
      const interestOnlyTotal = interestOnlyPayment * ioPeriodMonths;
      const principalAndInterestTotal = principalAndInterestPayment * remainingMonths;
      const totalPayment = interestOnlyTotal + principalAndInterestTotal;
      const totalInterest = totalPayment - principal;
      
      // Check for invalid results
      if (!isFinite(interestOnlyPayment) || isNaN(interestOnlyPayment) ||
          !isFinite(principalAndInterestPayment) || isNaN(principalAndInterestPayment)) {
        return { 
          monthly: 0, 
          total: 0, 
          totalInterest: 0,
          interestOnlyPayment: 0,
          principalAndInterestPayment: 0,
          interestOnlyTotal: 0
        };
      }

      return {
        monthly: principalAndInterestPayment, // This is for display compatibility
        total: totalPayment,
        totalInterest: totalInterest,
        interestOnlyPayment: interestOnlyPayment,
        principalAndInterestPayment: principalAndInterestPayment,
        interestOnlyTotal: interestOnlyTotal
      };
    } else {
      // Standard amortization (no interest-only period)
      let monthlyPayment: number;
      if (monthlyRate === 0) {
        monthlyPayment = principal / totalMonths;
      } else {
        monthlyPayment = 
          (principal * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
          (Math.pow(1 + monthlyRate, totalMonths) - 1);
      }
      
      const totalPayment = monthlyPayment * totalMonths;
      const totalInterest = totalPayment - principal;

      // Check for invalid results
      if (!isFinite(monthlyPayment) || isNaN(monthlyPayment)) {
        return { 
          monthly: 0, 
          total: 0, 
          totalInterest: 0,
          interestOnlyPayment: 0,
          principalAndInterestPayment: 0,
          interestOnlyTotal: 0
        };
      }

      return {
        monthly: monthlyPayment,
        total: totalPayment,
        totalInterest: totalInterest,
        interestOnlyPayment: 0,
        principalAndInterestPayment: 0,
        interestOnlyTotal: 0
      };
    }
  };

  const results = calculatePayment();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-white hover:bg-transparent border border-transparent hover:border-blue-500 hover:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors"
          title="Loan Calculator"
        >
          <Calculator className="h-6 w-6" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-gradient-to-br from-background via-background to-primary/5 border-border">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-2xl font-bold text-foreground">
            Commercial Loan Calculator
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-base">
            Calculate your monthly payments and see the full breakdown
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Input Fields Section */}
          <div className="space-y-5">
            {/* Loan Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-sm font-semibold text-foreground">
                Loan Amount
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                <Input
                  id="amount"
                  type="text"
                  value={formatNumberWithCommas(loanAmount)}
                  onChange={(e) => {
                    const parsed = parseNumberFromFormatted(e.target.value);
                    const value = parseFloat(parsed);
                    setLoanAmount(isNaN(value) || value < 0 ? '0' : parsed);
                  }}
                  className="pl-8 h-12 text-lg font-medium bg-background border-2 border-border focus:border-primary transition-colors"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Interest Rate */}
            <div className="space-y-2">
              <Label htmlFor="rate" className="text-sm font-semibold text-foreground">
                Interest Rate (Annual)
              </Label>
              <div className="relative">
                <Input
                  id="rate"
                  type="number"
                  min="0"
                  step="0.1"
                  value={interestRate}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setInterestRate(value < 0 ? '0' : e.target.value);
                  }}
                  className="pr-8 h-12 text-lg font-medium bg-background border-2 border-border focus:border-primary transition-colors"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">%</span>
              </div>
            </div>

            {/* Loan Term */}
            <div className="space-y-2">
              <Label htmlFor="term" className="text-sm font-semibold text-foreground">
                Loan Term
              </Label>
              <div className="flex gap-3">
                <Input
                  id="term"
                  type="number"
                  min="0"
                  value={loanTerm}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setLoanTerm(value < 0 ? '0' : e.target.value);
                  }}
                  className="flex-1 h-12 text-lg font-medium bg-background border-2 border-border focus:border-primary transition-colors"
                  placeholder="0"
                />
                <Select value={termUnit} onValueChange={(value: 'years' | 'months') => setTermUnit(value)}>
                  <SelectTrigger className="w-[140px] h-12 text-base font-medium bg-background border-2 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    <SelectItem value="years" className="text-base">Years</SelectItem>
                    <SelectItem value="months" className="text-base">Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Interest-Only Option */}
            <Card className="bg-primary/5 border-2 border-primary/20">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center justify-between mb-4">
                  <Label htmlFor="interest-only" className="text-sm font-semibold text-foreground cursor-pointer">
                    Interest-Only Period
                  </Label>
                  <Switch
                    id="interest-only"
                    checked={isInterestOnly}
                    onCheckedChange={setIsInterestOnly}
                  />
                </div>
                
                {isInterestOnly && (
                  <div className="space-y-2 animate-fade-in">
                    <Label htmlFor="io-period" className="text-xs text-muted-foreground">
                      Interest-Only Duration
                    </Label>
                    <div className="flex gap-3">
                      <Input
                        id="io-period"
                        type="number"
                        min="0"
                        value={interestOnlyPeriod}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          setInterestOnlyPeriod(value < 0 ? '0' : e.target.value);
                        }}
                        className="flex-1 h-10 text-base bg-background border-2 border-border focus:border-primary transition-colors"
                        placeholder="0"
                      />
                      <Select value={interestOnlyUnit} onValueChange={(value: 'years' | 'months') => setInterestOnlyUnit(value)}>
                        <SelectTrigger className="w-[140px] h-10 text-sm bg-background border-2 border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-background">
                          <SelectItem value="years" className="text-sm">Years</SelectItem>
                          <SelectItem value="months" className="text-sm">Months</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground italic mt-2">
                      Pay only interest for the initial period, then principal + interest
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Separator className="my-6" />

          {/* Results Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Payment Breakdown</h3>

            {/* Monthly Payment - Highlighted */}
            {isInterestOnly ? (
              <>
                {/* Interest-Only Payment */}
                <Card className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border-2 border-blue-500/20 shadow-lg">
                  <CardContent className="pt-6">
                    <div className="text-center space-y-2">
                      <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Interest-Only Payment</p>
                      <p className="text-4xl font-bold text-blue-600 dark:text-blue-400 animate-fade-in">
                        {formatCurrency(results.interestOnlyPayment)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        For {interestOnlyUnit === 'years' ? `${interestOnlyPeriod} years` : `${interestOnlyPeriod} months`}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Principal + Interest Payment */}
                <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-2 border-primary/20 shadow-lg">
                  <CardContent className="pt-6">
                    <div className="text-center space-y-2">
                      <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Then Principal + Interest</p>
                      <p className="text-4xl font-bold text-primary animate-fade-in">
                        {formatCurrency(results.principalAndInterestPayment)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        For remaining {(() => {
                          const ioPeriodMonths = interestOnlyUnit === 'years' 
                            ? parseFloat(interestOnlyPeriod) * 12 
                            : parseFloat(interestOnlyPeriod);
                          const totalMonths = termUnit === 'years' ? parseFloat(loanTerm) * 12 : parseFloat(loanTerm);
                          const remaining = totalMonths - ioPeriodMonths;
                          const years = Math.floor(remaining / 12);
                          const months = remaining % 12;
                          return years > 0 
                            ? `${years} year${years > 1 ? 's' : ''}${months > 0 ? ` ${months} month${months > 1 ? 's' : ''}` : ''}`
                            : `${months} month${months > 1 ? 's' : ''}`;
                        })()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-2 border-primary/20 shadow-lg">
                <CardContent className="pt-6">
                  <div className="text-center space-y-2">
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Monthly Payment</p>
                    <p className="text-5xl font-bold text-primary animate-fade-in">
                      {formatCurrency(results.monthly)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Based on {termUnit === 'years' ? `${loanTerm} years` : `${loanTerm} months`} at {interestRate}% APR
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Additional Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-card border-2 border-border hover:border-primary/50 transition-colors">
                <CardContent className="pt-5 pb-5">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Amount Paid</p>
                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrency(results.total)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-2 border-border hover:border-primary/50 transition-colors">
                <CardContent className="pt-5 pb-5">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Interest</p>
                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrency(results.totalInterest)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Principal Display */}
            <Card className="bg-muted/30 border border-border">
              <CardContent className="py-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Principal Amount</span>
                  <span className="text-lg font-semibold text-foreground">{formatCurrency(parseFloat(loanAmount) || 0)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Interest Breakdown Visualization */}
            {results.total > 0 && (
              <Card className="bg-muted/30 border border-border">
                <CardContent className="py-4">
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Payment Composition</p>
                    <div className="flex gap-1 h-8 rounded-full overflow-hidden">
                      <div 
                        className="bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground"
                        style={{ width: `${((parseFloat(loanAmount) || 0) / results.total) * 100}%` }}
                      >
                        {((parseFloat(loanAmount) || 0) / results.total * 100).toFixed(0)}%
                      </div>
                      <div 
                        className="bg-destructive flex items-center justify-center text-xs font-semibold text-destructive-foreground"
                        style={{ width: `${(results.totalInterest / results.total) * 100}%` }}
                      >
                        {(results.totalInterest / results.total * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-primary font-medium">● Principal</span>
                      <span className="text-destructive font-medium">Interest ●</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Button 
            onClick={() => setOpen(false)} 
            className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all"
          >
            Close Calculator
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
