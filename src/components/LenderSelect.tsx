import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building2 } from "lucide-react"

interface Lender {
  id: string
  name: string
  lender_type: string
  logo_url?: string
}

interface LenderSelectProps {
  value: string | null
  onChange: (lenderId: string) => void
  filterByType?: string[]
  placeholder?: string
  showLogo?: boolean
  disabled?: boolean
}

export function LenderSelect({
  value,
  onChange,
  filterByType,
  placeholder = "Select lender...",
  showLogo = true,
  disabled = false
}: LenderSelectProps) {
  const [lenders, setLenders] = useState<Lender[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLenders()
  }, [filterByType])

  const fetchLenders = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('lenders')
        .select('id, name, lender_type, logo_url')
        .eq('is_active', true)
        .order('name')

      if (filterByType && filterByType.length > 0) {
        query = query.in('lender_type', filterByType)
      }

      const { data, error } = await query

      if (error) throw error
      setLenders(data || [])
    } catch (error) {
      console.error('Error fetching lenders:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Select value={value || ""} onValueChange={onChange} disabled={disabled || loading}>
      <SelectTrigger>
        <SelectValue placeholder={loading ? "Loading lenders..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {lenders.map((lender) => (
          <SelectItem key={lender.id} value={lender.id}>
            <div className="flex items-center gap-2">
              {showLogo && lender.logo_url ? (
                <img src={lender.logo_url} alt={lender.name} className="h-4 w-4 object-contain" />
              ) : (
                <Building2 className="h-4 w-4 text-muted-foreground" />
              )}
              <span>{lender.name}</span>
              <span className="text-xs text-muted-foreground">({lender.lender_type})</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
