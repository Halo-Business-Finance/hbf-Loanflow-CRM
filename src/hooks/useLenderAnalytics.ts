import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface LenderPerformance {
  id: string;
  name: string;
  logo_url?: string;
  lender_type: string;
  total_loans: number;
  total_funded: number;
  avg_days_to_funding: number;
  funded_count: number;
  closed_count: number;
  conversion_rate: number;
}

export interface MonthlyPerformance {
  month: string;
  [key: string]: number | string;
}

export function useLenderAnalytics(dateRange?: { start: Date; end: Date }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [lenderPerformance, setLenderPerformance] = useState<LenderPerformance[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyPerformance[]>([]);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      // Fetch everything in parallel - 2 queries instead of N+1
      const [lendersResult, contactsResult] = await Promise.all([
        supabase
          .from('lenders')
          .select('id, name, logo_url, lender_type, is_active')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('contact_entities')
          .select('id, stage, loan_amount, created_at, updated_at, lender_id')
          .not('lender_id', 'is', null)
      ]);

      if (lendersResult.error) throw lendersResult.error;
      if (contactsResult.error) throw contactsResult.error;

      const lenders = lendersResult.data || [];
      const allContacts = contactsResult.data || [];

      // Group contacts by lender_id for fast lookup
      const contactsByLender = allContacts.reduce((acc, contact) => {
        if (!contact.lender_id) return acc;
        if (!acc[contact.lender_id]) acc[contact.lender_id] = [];
        acc[contact.lender_id].push(contact);
        return acc;
      }, {} as Record<string, typeof allContacts>);

      // Calculate performance data for all lenders
      const performanceData = lenders.map(lender => {
        const contacts = contactsByLender[lender.id] || [];
        const totalLoans = contacts.length;
        const fundedContacts = contacts.filter(c => 
          c.stage === 'funded' || c.stage === 'closed'
        );
        
        const totalFunded = fundedContacts.reduce((sum, c) => 
          sum + (Number(c.loan_amount) || 0), 0
        );

        // Calculate average days to funding
        const fundingTimes = fundedContacts
          .map(c => {
            const created = new Date(c.created_at).getTime();
            const updated = new Date(c.updated_at).getTime();
            return Math.floor((updated - created) / (1000 * 60 * 60 * 24));
          })
          .filter(days => days > 0);

        const avgDaysToFunding = fundingTimes.length > 0
          ? fundingTimes.reduce((sum, days) => sum + days, 0) / fundingTimes.length
          : 0;

        const fundedCount = fundedContacts.filter(c => c.stage === 'funded').length;
        const closedCount = fundedContacts.filter(c => c.stage === 'closed').length;
        const conversionRate = totalLoans > 0 
          ? (fundedContacts.length / totalLoans) * 100 
          : 0;

        return {
          id: lender.id,
          name: lender.name,
          logo_url: lender.logo_url,
          lender_type: lender.lender_type,
          total_loans: totalLoans,
          total_funded: totalFunded,
          avg_days_to_funding: avgDaysToFunding,
          funded_count: fundedCount,
          closed_count: closedCount,
          conversion_rate: conversionRate,
        };
      });

      setLenderPerformance(performanceData);

      // Calculate monthly trends for top 5 lenders
      const topLenders = performanceData
        .sort((a, b) => b.total_funded - a.total_funded)
        .slice(0, 5);

      const topLenderIds = new Set(topLenders.map(l => l.id));
      const monthsData: { [key: string]: any } = {};

      // Process monthly data from already-fetched contacts
      allContacts
        .filter(c => 
          c.lender_id && 
          topLenderIds.has(c.lender_id) &&
          (c.stage === 'funded' || c.stage === 'closed') &&
          new Date(c.updated_at) >= sixMonthsAgo
        )
        .forEach(contact => {
          const lender = topLenders.find(l => l.id === contact.lender_id);
          if (!lender) return;

          const month = new Date(contact.updated_at).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short' 
          });
          
          if (!monthsData[month]) {
            monthsData[month] = { month };
          }
          
          if (!monthsData[month][lender.name]) {
            monthsData[month][lender.name] = 0;
          }
          
          monthsData[month][lender.name] += Number(contact.loan_amount) || 0;
        });

      const monthlyArray = Object.values(monthsData).sort((a: any, b: any) => {
        return new Date(a.month).getTime() - new Date(b.month).getTime();
      });

      setMonthlyTrends(monthlyArray);

    } catch (error) {
      console.error('Error fetching lender analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load lender analytics",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    lenderPerformance,
    monthlyTrends,
    refetch: fetchAnalytics,
  };
}
