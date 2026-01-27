import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { IBMPageHeader } from "@/components/ui/IBMPageHeader"

export default function BorrowerDetails() {
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-8 space-y-8 animate-fade-in">
        <IBMPageHeader 
          title="Borrower Details"
          subtitle="Manage borrower information and loan details"
        />

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border border-blue-600">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>
              Basic borrower details and contact information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" placeholder="John" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" placeholder="Smith" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" placeholder="john.smith@example.com" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" placeholder="(555) 123-4567" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ssn">SSN</Label>
                <Input id="ssn" placeholder="XXX-XX-XXXX" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" placeholder="123 Main St, City, State, ZIP" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-blue-600">
          <CardHeader>
            <CardTitle>Financial Information</CardTitle>
            <CardDescription>
              Income, employment, and financial details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="income">Annual Income</Label>
                <Input id="income" placeholder="$75,000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employment">Employment Status</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employed">Employed</SelectItem>
                    <SelectItem value="self-employed">Self-Employed</SelectItem>
                    <SelectItem value="unemployed">Unemployed</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employer">Employer</Label>
              <Input id="employer" placeholder="Company Name" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="creditScore">Credit Score</Label>
                <Input id="creditScore" placeholder="750" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assets">Total Assets</Label>
                <Input id="assets" placeholder="$150,000" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="debts">Monthly Debts</Label>
              <Input id="debts" placeholder="$2,500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-blue-600">
        <CardHeader>
          <CardTitle>Loan History</CardTitle>
          <CardDescription>
            Previous and current loans for this borrower
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 border rounded-lg">
              <div>
                <div className="font-medium">Mortgage Loan #12345</div>
                <div className="text-sm text-muted-foreground">$350,000 • 30-year fixed • 3.25%</div>
              </div>
              <span className="text-sm font-medium">Active</span>
            </div>
            <div className="flex justify-between items-center p-3 border rounded-lg">
              <div>
                <div className="font-medium">Auto Loan #67890</div>
                <div className="text-sm text-muted-foreground">$25,000 • 5-year • 4.5%</div>
              </div>
              <span className="text-sm font-medium">Paid Off</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button>Save Changes</Button>
        <Button variant="outline">Cancel</Button>
      </div>
      </div>
    </div>
  )
}