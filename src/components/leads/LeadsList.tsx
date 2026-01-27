import { Lead } from "@/types/lead"
import { LeadTableRow } from "@/components/LeadTableRow"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface LeadsListProps {
  leads: Lead[]
  onEdit: (lead: Lead) => void
  onDelete: (leadId: string, leadName: string) => void
  onConvert: (lead: Lead) => void
  onRefresh?: () => void
  hasAdminRole: boolean
  currentUserId?: string
  selectedLeads: string[]
  onSelectAll: (selected: boolean) => void
  onSelectLead: (leadId: string, selected: boolean) => void
  sortColumn?: 'name' | 'created_at' | 'loan_amount' | 'stage' | null
  sortDirection?: 'asc' | 'desc'
  onSort?: (column: 'name' | 'created_at' | 'loan_amount' | 'stage') => void
  isCompact?: boolean
}

export function LeadsList({ 
  leads, 
  onEdit, 
  onDelete, 
  onConvert, 
  onRefresh,
  hasAdminRole,
  currentUserId,
  selectedLeads,
  onSelectAll,
  onSelectLead,
  sortColumn,
  sortDirection,
  onSort,
  isCompact = false
}: LeadsListProps) {
  if (leads.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No leads found matching your criteria.</p>
      </div>
    )
  }

  const allSelected = leads.length > 0 && selectedLeads.length === leads.length
  const someSelected = selectedLeads.length > 0 && selectedLeads.length < leads.length

  const SortIcon = ({ column }: { column: 'name' | 'created_at' | 'loan_amount' | 'stage' }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3.5 w-3.5 ml-1" />
      : <ArrowDown className="h-3.5 w-3.5 ml-1" />
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow className={`sticky top-0 z-10 border-b border-border hover:bg-transparent bg-muted/30 backdrop-blur supports-[backdrop-filter]:bg-muted/60 ${isCompact ? 'h-9' : ''}`}>
            <TableHead className={`w-[220px] ${isCompact ? 'px-2 py-1' : 'px-4'}`}>
              <div className={`flex items-center ${isCompact ? 'gap-2' : 'gap-3'}`}>
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={onSelectAll}
                  aria-label="Select all leads"
                  className={someSelected ? "data-[state=checked]:bg-primary/50" : ""}
                />
                {onSort ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSort('name')}
                    className={`h-auto p-0 hover:bg-transparent font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground ${isCompact ? 'text-[10px]' : 'text-xs'}`}
                  >
                    Lead Name
                    <SortIcon column="name" />
                  </Button>
                ) : (
                  <span className={`font-medium uppercase tracking-wider text-muted-foreground ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
                    Lead Name
                  </span>
                )}
              </div>
            </TableHead>
            <TableHead className={`font-medium uppercase tracking-wider text-muted-foreground ${isCompact ? 'px-2 py-1 text-[10px]' : 'px-4 text-xs'}`}>Contact Information</TableHead>
            <TableHead className={isCompact ? 'px-2 py-1' : 'px-4'}>
              {onSort ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSort('loan_amount')}
                  className={`h-auto p-0 hover:bg-transparent font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground ${isCompact ? 'text-[10px]' : 'text-xs'}`}
                >
                  Loan Details
                  <SortIcon column="loan_amount" />
                </Button>
              ) : (
                <span className={`font-medium uppercase tracking-wider text-muted-foreground ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
                  Loan Details
                </span>
              )}
            </TableHead>
            <TableHead className={isCompact ? 'px-2 py-1' : 'px-4'}>
              {onSort ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSort('stage')}
                  className={`h-auto p-0 hover:bg-transparent font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground ${isCompact ? 'text-[10px]' : 'text-xs'}`}
                >
                  Lead Status
                  <SortIcon column="stage" />
                </Button>
              ) : (
                <span className={`font-medium uppercase tracking-wider text-muted-foreground ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
                  Lead Status
                </span>
              )}
            </TableHead>
            <TableHead className={isCompact ? 'px-2 py-1' : 'px-4'}>
              {onSort ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSort('created_at')}
                  className={`h-auto p-0 hover:bg-transparent font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground ${isCompact ? 'text-[10px]' : 'text-xs'}`}
                >
                  Created
                  <SortIcon column="created_at" />
                </Button>
              ) : (
                <span className={`font-medium uppercase tracking-wider text-muted-foreground ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
                  Created
                </span>
              )}
            </TableHead>
            <TableHead className={`w-[280px] text-right font-medium uppercase tracking-wider text-muted-foreground ${isCompact ? 'px-2 py-1 text-[10px]' : 'px-4 text-xs'}`}>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead, index) => (
            <LeadTableRow
              key={lead.id}
              lead={lead}
              onEdit={onEdit}
              onDelete={onDelete}
              onConvert={onConvert}
              onRefresh={onRefresh}
              hasAdminRole={hasAdminRole}
              currentUserId={currentUserId}
              isSelected={selectedLeads.includes(lead.id)}
              onSelectChange={(selected) => onSelectLead(lead.id, selected)}
              isEvenRow={index % 2 === 0}
              isCompact={isCompact}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}