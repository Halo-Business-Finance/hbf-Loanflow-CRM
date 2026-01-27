import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Users, DollarSign, Target } from "lucide-react"
import { Lead } from "@/types/lead"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer } from "recharts"
import { useState } from "react"

interface LeadStatsProps {
  leads: Lead[]
}

export function LeadStats({ leads }: LeadStatsProps) {
  const [openDialog, setOpenDialog] = useState<string | null>(null)
  
  const totalLeads = leads.length
  const convertedLeads = leads.filter(lead => lead.is_converted_to_client).length
  const totalValue = leads.reduce((sum, lead) => sum + (lead.loan_amount || 0), 0)
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0

  // Prepare chart data
  const stageData = leads.reduce((acc: any[], lead) => {
    const existing = acc.find(item => item.stage === lead.stage)
    if (existing) {
      existing.count++
    } else {
      acc.push({ stage: lead.stage, count: 1 })
    }
    return acc
  }, [])

  const valueData = leads.reduce((acc: any[], lead) => {
    const month = new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short' })
    const existing = acc.find(item => item.month === month)
    if (existing) {
      existing.value += lead.loan_amount || 0
    } else {
      acc.push({ month, value: lead.loan_amount || 0 })
    }
    return acc
  }, [])

  const conversionData = [
    { name: 'Converted', value: convertedLeads, fill: 'hsl(var(--primary))' },
    { name: 'Not Converted', value: totalLeads - convertedLeads, fill: 'hsl(var(--muted))' }
  ]

  const stats = [
    {
      title: "Total Leads",
      value: totalLeads,
      icon: Users,
      description: "All active leads",
      key: "total"
    },
    {
      title: "Total Value",
      value: `$${totalValue.toLocaleString()}`,
      icon: DollarSign,
      description: "Pipeline value",
      key: "value"
    },
    {
      title: "Converted",
      value: convertedLeads,
      icon: Target,
      description: "Leads to clients",
      key: "converted"
    },
    {
      title: "Conversion Rate",
      value: `${conversionRate}%`,
      icon: TrendingUp,
      description: "Success rate",
      key: "rate"
    }
  ]

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <Card 
            key={stat.title} 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setOpenDialog(stat.key)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Total Leads Dialog */}
      <Dialog open={openDialog === "total"} onOpenChange={() => setOpenDialog(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Total Leads ({totalLeads})</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {leads.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">{lead.contact_entity?.business_name || lead.contact_entity?.name}</h4>
                  <p className="text-sm text-muted-foreground">{lead.contact_entity?.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{lead.stage}</Badge>
                  <span className="text-sm font-medium">${(lead.loan_amount || 0).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Total Value Dialog */}
      <Dialog open={openDialog === "value"} onOpenChange={() => setOpenDialog(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Total Pipeline Value - ${totalValue.toLocaleString()}</DialogTitle>
          </DialogHeader>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={valueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
                <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, 'Value']} />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </DialogContent>
      </Dialog>

      {/* Converted Dialog */}
      <Dialog open={openDialog === "converted"} onOpenChange={() => setOpenDialog(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Leads by Stage</DialogTitle>
          </DialogHeader>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="stage" label={{ value: 'Loan Stage', position: 'insideBottom', offset: -5 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DialogContent>
      </Dialog>

      {/* Conversion Rate Dialog */}
      <Dialog open={openDialog === "rate"} onOpenChange={() => setOpenDialog(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Conversion Rate - {conversionRate}%</DialogTitle>
          </DialogHeader>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={conversionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {conversionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}