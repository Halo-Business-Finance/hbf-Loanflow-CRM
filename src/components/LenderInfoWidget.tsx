import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Building2, Phone, Mail, TrendingUp, Clock, ExternalLink } from "lucide-react"
import { formatPhoneNumber } from "@/lib/utils"

interface LenderDetails {
  id: string
  name: string
  lender_type: string
  logo_url?: string
  phone?: string
  email?: string
  website?: string
  city?: string
  state?: string
}

interface LenderPerformance {
  avg_days_to_fund: number
  success_rate: number
  total_funded: number
}

interface LenderInfoWidgetProps {
  lenderId: string | null
}

export function LenderInfoWidget({ lenderId }: LenderInfoWidgetProps) {
  const navigate = useNavigate()
  const [lender, setLender] = useState<LenderDetails | null>(null)
  const [performance, setPerformance] = useState<LenderPerformance | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (lenderId) {
      fetchLenderDetails()
    } else {
      setLender(null)
      setPerformance(null)
      setLoading(false)
    }
  }, [lenderId])

  const fetchLenderDetails = async () => {
    if (!lenderId) return

    try {
      setLoading(true)

      // Fetch lender details
      const { data: lenderData, error: lenderError } = await supabase
        .from('lenders')
        .select('id, name, lender_type, logo_url, phone, email, website, city, state')
        .eq('id', lenderId)
        .single()

      if (lenderError) throw lenderError
      setLender(lenderData)

      // Fetch performance metrics from contact_entities (which has lender_id and stage)
      const { data: contactsData } = await supabase
        .from('contact_entities')
        .select('stage, created_at, updated_at')
        .eq('lender_id', lenderId)

      if (contactsData) {
        const fundedLoans = contactsData.filter(c => c.stage === 'Loan Funded')
        const totalFunded = fundedLoans.length
        const successRate = contactsData.length > 0 
          ? Math.round((totalFunded / contactsData.length) * 100) 
          : 0

        // Calculate average days to fund
        const daysToFund = fundedLoans.map(contact => {
          const created = new Date(contact.created_at)
          const updated = new Date(contact.updated_at)
          return Math.floor((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
        })
        const avgDays = daysToFund.length > 0
          ? Math.round(daysToFund.reduce((a, b) => a + b, 0) / daysToFund.length)
          : 0

        setPerformance({
          avg_days_to_fund: avgDays,
          success_rate: successRate,
          total_funded: totalFunded
        })
      }
    } catch (error) {
      console.error('Error fetching lender details:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!lenderId) return null

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Bank/Lender Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!lender) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Bank/Lender Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lender Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {lender.logo_url ? (
              <img src={lender.logo_url} alt={lender.name} className="h-12 w-12 object-contain" />
            ) : (
              <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div>
              <h3 className="font-semibold">{lender.name}</h3>
              <Badge variant="secondary">{lender.lender_type}</Badge>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/lenders/${lender.id}`)}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            View Profile
          </Button>
        </div>

        {/* Contact Information */}
        <div className="space-y-2 pt-3 border-t">
          {lender.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <a href={`tel:${lender.phone}`} className="hover:underline">
                {formatPhoneNumber(lender.phone)}
              </a>
            </div>
          )}
          {lender.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${lender.email}`} className="hover:underline">
                {lender.email}
              </a>
            </div>
          )}
          {lender.city && lender.state && (
            <div className="text-sm text-muted-foreground">
              {lender.city}, {lender.state}
            </div>
          )}
        </div>

        {/* Performance Metrics */}
        {performance && (
          <div className="space-y-2 pt-3 border-t">
            <h4 className="text-sm font-semibold">Performance Metrics</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Avg Time</span>
                </div>
                <div className="text-sm font-semibold">{performance.avg_days_to_fund} days</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  <span>Success Rate</span>
                </div>
                <div className="text-sm font-semibold">{performance.success_rate}%</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Total Funded</div>
                <div className="text-sm font-semibold">{performance.total_funded}</div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex gap-2 pt-3 border-t">
          {lender.phone && (
            <Button variant="outline" size="sm" asChild>
              <a href={`tel:${lender.phone}`}>
                <Phone className="h-4 w-4 mr-1" />
                Call
              </a>
            </Button>
          )}
          {lender.email && (
            <Button variant="outline" size="sm" asChild>
              <a href={`mailto:${lender.email}`}>
                <Mail className="h-4 w-4 mr-1" />
                Email
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
