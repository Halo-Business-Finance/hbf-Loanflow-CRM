import React from "react"
import { useNavigate } from "react-router-dom"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { 
  Mail, 
  Phone, 
  ArrowRight, 
  Trash2,
  Edit,
  MoreHorizontal,
  Building2,
  DollarSign,
  FileText,
  Eye
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Lead } from "@/types/lead"
import { ClickablePhone } from "@/components/ui/clickable-phone"

interface LeadTableRowProps {
  lead: Lead
  onEdit?: (lead: Lead) => void
  onDelete?: (leadId: string, leadName: string) => void
  onConvert?: (lead: Lead) => void
  hasAdminRole: boolean
  onRefresh?: () => void
  currentUserId?: string
  isSelected?: boolean
  onSelectChange?: (selected: boolean) => void
  isEvenRow?: boolean
  isCompact?: boolean
}

export function LeadTableRow({ 
  lead, 
  onEdit, 
  onDelete, 
  onConvert, 
  hasAdminRole, 
  onRefresh, 
  currentUserId,
  isSelected = false,
  onSelectChange,
  isEvenRow = false,
  isCompact = false
}: LeadTableRowProps) {
  const navigate = useNavigate()

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const canDelete = hasAdminRole

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'bg-red-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <tr 
      className={`group border-b border-border/50 hover:bg-accent/50 transition-colors cursor-pointer ${
        lead.is_converted_to_client ? 'opacity-60' : ''
      } ${isEvenRow ? 'bg-muted/20' : 'bg-background'}`}
      onClick={() => navigate(`/leads/${lead.id}`)}
    >
      {/* Column 1: Lead Info with Checkbox */}
      <td className={isCompact ? 'px-2 py-1.5' : 'px-4 py-4'} onClick={(e) => e.stopPropagation()}>
        <div className={`flex items-center ${isCompact ? 'gap-2' : 'gap-3'}`}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => {
              onSelectChange?.(checked as boolean)
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${lead.name}`}
          />
          <div className={`flex flex-col min-w-0 ${isCompact ? 'gap-0.5' : 'gap-1.5'}`}>
            {lead.business_name && (
              <div className="flex items-center gap-1.5">
                <span className={`text-muted-foreground truncate ${isCompact ? 'text-[10px]' : 'text-xs'}`}>{lead.business_name}</span>
              </div>
            )}
            <span className={`text-foreground group-hover:text-primary transition-colors truncate ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
              {lead.name}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-muted-foreground ${isCompact ? 'text-[9px]' : 'text-xs'}`}>
                Loan ID: {String(lead.lead_number).padStart(3, '0')}
              </span>
              {lead.is_converted_to_client && (
                <Badge 
                  variant="secondary" 
                  className={`px-1.5 py-0 bg-emerald-500/10 text-emerald-600 border-0 dark:text-emerald-400 ${isCompact ? 'text-[9px] h-4' : 'text-xs h-5'}`}
                >
                  Converted
                </Badge>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* Column 2: Contact Information */}
      <td className={isCompact ? 'px-2 py-1.5' : 'px-4 py-4'}>
        <div className={isCompact ? 'space-y-0.5' : 'space-y-1.5'}>
          {lead.phone && (
            <div className="flex items-center gap-2">
              <Phone className={`text-muted-foreground flex-shrink-0 ${isCompact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'}`} />
              <ClickablePhone 
                phoneNumber={lead.phone} 
                className={`text-foreground hover:text-primary transition-colors ${isCompact ? 'text-[10px]' : 'text-xs'}`} 
              />
            </div>
          )}
          {lead.email && (
            <div className="flex items-center gap-2">
              <Mail className={`text-muted-foreground flex-shrink-0 ${isCompact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'}`} />
              <a 
                href={`mailto:${lead.email}`}
                className={`text-foreground hover:text-primary transition-colors truncate ${isCompact ? 'text-[10px]' : 'text-xs'}`}
                onClick={(e) => e.stopPropagation()}
              >
                {lead.email}
              </a>
            </div>
          )}
          {!lead.phone && !lead.email && (
            <span className={`text-muted-foreground italic ${isCompact ? 'text-[10px]' : 'text-xs'}`}>No contact</span>
          )}
        </div>
      </td>

      {/* Column 3: Lead Details */}
      <td className={isCompact ? 'px-2 py-1.5' : 'px-4 py-4'}>
        <div className={isCompact ? 'space-y-0.5' : 'space-y-1.5'}>
          {lead.loan_type && (
            <div className="flex items-center gap-2">
              <FileText className={`text-muted-foreground ${isCompact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'}`} />
              <span className={`text-foreground ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
                {lead.loan_type}
              </span>
            </div>
          )}
          {lead.loan_amount && (
            <div className="flex items-center gap-2">
              <DollarSign className={`text-muted-foreground ${isCompact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'}`} />
              <span className={`text-foreground ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
                {formatCurrency(lead.loan_amount)}
              </span>
            </div>
          )}
        </div>
      </td>

      {/* Column 4: Status (Loan Stage & Priority) */}
      <td className={isCompact ? 'px-2 py-1.5' : 'px-4 py-4'}>
        <div className={isCompact ? 'space-y-0.5' : 'space-y-1.5'}>
          {lead.stage && (
            <Badge 
              variant="secondary" 
              className={`px-2 bg-secondary/30 hover:bg-secondary/50 transition-colors border-0 ${isCompact ? 'text-[9px] py-0 h-4' : 'text-xs py-0.5'}`}
            >
              {lead.stage}
            </Badge>
          )}
          {lead.priority && (
            <div className="flex items-center gap-1.5">
              <div className={`rounded-full ${getPriorityColor(lead.priority)} ${isCompact ? 'w-1 h-1' : 'w-1.5 h-1.5'}`} />
              <span className={`text-muted-foreground capitalize ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
                {lead.priority}
              </span>
            </div>
          )}
        </div>
      </td>

      {/* Column 5: Created Date */}
      <td className={isCompact ? 'px-2 py-1.5' : 'px-4 py-4'}>
        <div className="flex flex-col gap-0.5">
          <span className={`text-foreground ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
            {lead.created_at ? format(new Date(lead.created_at), 'MMM d, yyyy') : '-'}
          </span>
          {lead.created_at && (
            <span className={`text-muted-foreground ${isCompact ? 'text-[9px]' : 'text-[10px]'}`}>
              {format(new Date(lead.created_at), 'h:mm a')}
            </span>
          )}
        </div>
      </td>

      {/* Column 6: Actions */}
      <td className={`text-right ${isCompact ? 'px-2 py-1.5' : 'px-4 py-4'}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/leads/${lead.id}`)}
            className={`font-medium flex items-center justify-center ${isCompact ? 'h-6 px-2' : 'h-8 px-3'}`}
          >
            <Eye className={isCompact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} />
            <span className={`ml-1 ${isCompact ? 'text-[10px]' : 'text-xs'}`}>View</span>
          </Button>
          
          {onEdit && (
            <Button
              size="sm"
              onClick={() => onEdit(lead)}
              className={`font-medium bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center ${isCompact ? 'h-6 px-2' : 'h-8 px-3'}`}
            >
              <Edit className={isCompact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} />
              <span className={`ml-1 ${isCompact ? 'text-[10px]' : 'text-xs'}`}>Edit</span>
            </Button>
          )}
          
          {!lead.is_converted_to_client && onConvert && (
            <Button
              size="sm"
              onClick={() => onConvert(lead)}
              className={`font-medium bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center ${isCompact ? 'h-6 px-2' : 'h-8 px-3'}`}
            >
              <ArrowRight className={isCompact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} />
              <span className={`ml-1 ${isCompact ? 'text-[10px]' : 'text-xs'}`}>Convert</span>
            </Button>
          )}
          
          {canDelete && onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDelete(lead.id, lead.name)}
              className={`font-medium flex items-center justify-center ${isCompact ? 'h-6 px-2' : 'h-8 px-3'}`}
            >
              <Trash2 className={isCompact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} />
              <span className={`ml-1 ${isCompact ? 'text-[10px]' : 'text-xs'}`}>Delete</span>
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}