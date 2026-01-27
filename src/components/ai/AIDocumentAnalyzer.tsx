import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { 
  Brain, 
  Upload, 
  FileText, 
  DollarSign, 
  TrendingUp,
  Loader2,
  CheckCircle,
  AlertCircle
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function AIDocumentAnalyzer() {
  const [file, setFile] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<any>(null)
  const { toast } = useToast()

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0]
    if (uploadedFile) {
      setFile(uploadedFile)
      setAnalysis(null)
    }
  }

  const analyzeDocument = async () => {
    if (!file) return

    setAnalyzing(true)
    try {
      // TODO: Replace with actual AI service integration
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // For now, show a message that this feature requires AI service setup
      toast({
        title: "AI Service Required",
        description: "Document analysis requires AI service integration. Please contact your administrator.",
        variant: "destructive",
      })
      
      setAnalysis(null)
    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: "Unable to analyze document. Please try again.",
        variant: "destructive",
      })
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Upload Section */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>
            <span className="underline">AI Document Analyzer</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="document">Upload Document</Label>
            <div className="mt-2">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">PDF, PNG, JPG (MAX. 10MB)</p>
                </div>
                <input
                  id="document"
                  type="file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>

          {file && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <FileText className="h-4 w-4" />
              <span className="text-sm font-medium">{file.name}</span>
              <Badge variant="secondary" className="ml-auto">
                {(file.size / (1024 * 1024)).toFixed(1)} MB
              </Badge>
            </div>
          )}

          <Button 
            onClick={analyzeDocument}
            disabled={!file || analyzing}
            className="w-full"
          >
            {analyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="mr-2 h-4 w-4" />
                Analyze Document
              </>
            )}
          </Button>

          <div className="space-y-2">
            <h4 className="font-medium text-sm underline">Supported Documents:</h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>• Pay Stubs</div>
              <div>• Bank Statements</div>
              <div>• Tax Returns</div>
              <div>• W-2 Forms</div>
              <div>• 1099 Forms</div>
              <div>• Financial Statements</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Section */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="dark:text-white">
            <span className="underline">Analysis Results</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!analysis ? (
            <div className="text-center py-8 text-muted-foreground dark:text-white">
              <Brain className="h-12 w-12 mx-auto mb-4 opacity-50 dark:text-white" />
              <p>Upload and analyze a document to see results</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium dark:text-white underline">Document Type</h4>
                <Badge variant="secondary">{analysis.documentType}</Badge>
              </div>

              <div className="flex items-center justify-between">
                <h4 className="font-medium dark:text-white underline">Risk Score</h4>
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold text-green-600">{analysis.riskScore}</div>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h4 className="font-medium dark:text-white underline">Confidence</h4>
                <div className="text-lg font-semibold dark:text-white">{analysis.confidence}%</div>
              </div>

              <div>
                <h4 className="font-medium mb-2 dark:text-white underline">Extracted Data</h4>
                <div className="space-y-2 text-sm">
                  {Object.entries(analysis.extractedData).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-muted-foreground dark:text-white capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}:
                      </span>
                      <span className="font-medium dark:text-white">{value as string}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2 dark:text-white underline">AI Recommendations</h4>
                <div className="space-y-2">
                  {analysis.recommendations.map((rec: string, index: number) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="dark:text-white">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => {
                  // Auto-populate loan application functionality
                  if (analysis) {
                    const { toast } = require("@/hooks/use-toast")
                    toast({
                      title: "Feature Coming Soon",
                      description: "Auto-populate loan application will be available in the next update.",
                    })
                  }
                }}
              >
                <DollarSign className="mr-2 h-4 w-4" />
                Auto-populate Loan Application
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}