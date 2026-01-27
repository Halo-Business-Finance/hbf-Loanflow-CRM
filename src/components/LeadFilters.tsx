import React from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

import { Search, Filter, X, SlidersHorizontal } from "lucide-react"

interface LeadFiltersProps {
  searchTerm: string
  setSearchTerm: (term: string) => void
  selectedStage: string
  setSelectedStage: (stage: string) => void
  selectedPriority: string
  setSelectedPriority: (priority: string) => void
  totalLeads: number
  filteredCount: number
}

const stages = ["All", "New Lead", "Initial Contact", "Loan Application Signed", "Waiting for Documentation", "Pre-Approved", "Term Sheet Signed", "Loan Approved", "Closing", "Loan Funded", "Archive"]
const priorities = ["All", "High", "Medium", "Low"]

export function LeadFilters({
  searchTerm,
  setSearchTerm,
  selectedStage,
  setSelectedStage,
  selectedPriority,
  setSelectedPriority,
  totalLeads,
  filteredCount
}: LeadFiltersProps) {
  const activeFilters = []
  if (selectedStage !== "All") activeFilters.push(selectedStage)
  if (selectedPriority !== "All") activeFilters.push(selectedPriority)
  if (searchTerm) activeFilters.push("Search")

  const clearAllFilters = () => {
    setSearchTerm("")
    setSelectedStage("All")
    setSelectedPriority("All")
  }

  return (
    <div className="space-y-4">
      {/* Search and Quick Stats */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white w-4 h-4" />
          <Input
            placeholder="Search leads by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-background/50 border-muted/30 focus:border-primary/50"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => setSearchTerm("")}
            >
              <X className="w-4 h-4 text-white" />
            </Button>
          )}
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground dark:text-white">
          <span className="font-medium text-foreground dark:text-white">{filteredCount}</span>
          <span>of</span>
          <span className="font-medium text-foreground dark:text-white">{totalLeads}</span>
          <span>leads</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-white" />
          <span className="text-sm font-medium text-foreground dark:text-white">Filters:</span>
        </div>
        
        <Select value={selectedStage} onValueChange={setSelectedStage}>
          <SelectTrigger className="w-auto min-w-[130px] h-9 bg-background/50 border-muted/30">
            <SelectValue placeholder="Loan Stage" />
          </SelectTrigger>
          <SelectContent>
            {stages.map(stage => (
              <SelectItem key={stage} value={stage}>
                {stage}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedPriority} onValueChange={setSelectedPriority}>
          <SelectTrigger className="w-auto min-w-[110px] h-9 bg-background/50 border-muted/30">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            {priorities.map(priority => (
              <SelectItem key={priority} value={priority}>
                {priority}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {activeFilters.length > 0 && (
          <>
            <div className="w-px h-6 bg-muted/50" />
            <div className="flex items-center gap-2">
              {activeFilters.map((filter, index) => (
                <span key={index} className="text-xs">
                  {filter}
                </span>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-xs text-muted-foreground dark:text-white hover:text-foreground h-7 px-2"
              >
                Clear all
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}