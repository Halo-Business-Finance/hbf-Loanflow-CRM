import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Check, X, AlertTriangle, Loader2, FileSpreadsheet, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ibmDb } from "@/lib/ibm";
import { getAuthUser } from '@/lib/auth-utils';
import readXlsxFile from "read-excel-file";

interface CSVImporterProps {
  onImportComplete?: () => void;
}

interface ParsedRow {
  [key: string]: string;
}

interface FieldMapping {
  csvColumn: string;
  dbField: string;
}

type ImportDestination = "leads" | "lenders" | "service_providers";

interface DestinationConfig {
  label: string;
  description: string;
  table: string;
  fields: { value: string; label: string }[];
  requiredFields: string[];
}

const DESTINATION_CONFIGS: Record<ImportDestination, DestinationConfig> = {
  leads: {
    label: "New Leads / Contacts",
    description: "Import leads, borrowers, or contact information",
    table: "contact_entities",
    requiredFields: ["name", "email"],
    fields: [
      { value: "name", label: "Name" },
      { value: "first_name", label: "First Name" },
      { value: "last_name", label: "Last Name" },
      { value: "email", label: "Email" },
      { value: "phone", label: "Phone" },
      { value: "mobile_phone", label: "Mobile Phone" },
      { value: "business_name", label: "Business Name" },
      { value: "business_type", label: "Business Type" },
      { value: "business_address", label: "Business Address" },
      { value: "business_city", label: "Business City" },
      { value: "business_state", label: "Business State" },
      { value: "business_zip_code", label: "Business Zip Code" },
      { value: "loan_amount", label: "Loan Amount" },
      { value: "loan_type", label: "Loan Type" },
      { value: "annual_revenue", label: "Annual Revenue" },
      { value: "credit_score", label: "Credit Score" },
      { value: "years_in_business", label: "Years in Business" },
      { value: "industry", label: "Industry" },
      { value: "notes", label: "Notes" },
      { value: "source", label: "Source" },
      { value: "stage", label: "Stage" },
      { value: "priority", label: "Priority" },
      { value: "skip", label: "-- Skip this column --" },
    ],
  },
  lenders: {
    label: "Banks & Lenders",
    description: "Import bank and lender information",
    table: "lenders",
    requiredFields: ["name"],
    fields: [
      { value: "name", label: "Lender Name" },
      { value: "lender_type", label: "Lender Type" },
      { value: "contact_name", label: "Contact Name" },
      { value: "email", label: "Email" },
      { value: "phone", label: "Phone" },
      { value: "address", label: "Address" },
      { value: "city", label: "City" },
      { value: "state", label: "State" },
      { value: "zip_code", label: "Zip Code" },
      { value: "website", label: "Website" },
      { value: "min_loan_amount", label: "Min Loan Amount" },
      { value: "max_loan_amount", label: "Max Loan Amount" },
      { value: "interest_rate_min", label: "Min Interest Rate" },
      { value: "interest_rate_max", label: "Max Interest Rate" },
      { value: "loan_types", label: "Loan Types" },
      { value: "specialty", label: "Specialty" },
      { value: "notes", label: "Notes" },
      { value: "status", label: "Status" },
      { value: "skip", label: "-- Skip this column --" },
    ],
  },
  service_providers: {
    label: "Title & Escrow Companies",
    description: "Import title companies, escrow companies, and other service providers",
    table: "service_providers",
    requiredFields: ["name", "provider_type"],
    fields: [
      { value: "name", label: "Company Name" },
      { value: "provider_type", label: "Provider Type (title/escrow/insurance/appraisal)" },
      { value: "contact_name", label: "Contact Name" },
      { value: "email", label: "Email" },
      { value: "phone", label: "Phone" },
      { value: "address", label: "Address" },
      { value: "city", label: "City" },
      { value: "state", label: "State" },
      { value: "zip_code", label: "Zip Code" },
      { value: "website", label: "Website" },
      { value: "license_number", label: "License Number" },
      { value: "services_offered", label: "Services Offered" },
      { value: "notes", label: "Notes" },
      { value: "status", label: "Status" },
      { value: "skip", label: "-- Skip this column --" },
    ],
  },
};

export function CSVImporter({ onImportComplete }: CSVImporterProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [destination, setDestination] = useState<ImportDestination>("leads");
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<"csv" | "excel" | null>(null);
  const [csvData, setCsvData] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  const currentConfig = DESTINATION_CONFIGS[destination];

  const parseCSV = (text: string): { headers: string[]; rows: ParsedRow[] } => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    const headerLine = lines[0];
    const parsedHeaders = parseCSVLine(headerLine);

    const rows: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === parsedHeaders.length) {
        const row: ParsedRow = {};
        parsedHeaders.forEach((header, index) => {
          row[header] = values[index] || "";
        });
        rows.push(row);
      }
    }

    return { headers: parsedHeaders, rows };
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const parseExcel = async (file: File): Promise<{ headers: string[]; rows: ParsedRow[] }> => {
    const rows = await readXlsxFile(file);
    if (rows.length === 0) return { headers: [], rows: [] };

    const parsedHeaders = (rows[0] as unknown[]).map(h => String(h ?? "").trim());
    const parsedRows: ParsedRow[] = [];

    for (let i = 1; i < rows.length; i++) {
      const rowData = rows[i] as unknown[];
      if (rowData && rowData.length > 0) {
        const row: ParsedRow = {};
        parsedHeaders.forEach((header, index) => {
          row[header] = String(rowData[index] ?? "").trim();
        });
        parsedRows.push(row);
      }
    }

    return { headers: parsedHeaders, rows: parsedRows };
  };

  const processFile = (parsedHeaders: string[], rows: ParsedRow[]) => {
    setHeaders(parsedHeaders);
    setCsvData(rows);
    
    const mappings: FieldMapping[] = parsedHeaders.map(header => {
      const normalizedHeader = header.toLowerCase().replace(/[_\s-]/g, "");
      const matchedField = currentConfig.fields.find(f => {
        const normalizedField = f.value.toLowerCase().replace(/[_\s-]/g, "");
        return normalizedHeader.includes(normalizedField) || normalizedField.includes(normalizedHeader);
      });
      return {
        csvColumn: header,
        dbField: matchedField?.value || "skip",
      };
    });
    setFieldMappings(mappings);

    toast({
      title: "File Loaded",
      description: `Found ${rows.length} rows with ${parsedHeaders.length} columns.`,
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    const fileName = selectedFile.name.toLowerCase();
    const isCSV = fileName.endsWith(".csv");
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");

    if (!isCSV && !isExcel) {
      toast({
        title: "Invalid File",
        description: "Please select a CSV or Excel file (.csv, .xlsx, .xls).",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    setFileType(isCSV ? "csv" : "excel");
    setImportResults(null);

    if (isCSV) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const { headers: parsedHeaders, rows } = parseCSV(text);
        processFile(parsedHeaders, rows);
      };
      reader.readAsText(selectedFile);
    } else {
      // read-excel-file accepts File directly — no FileReader needed
      parseExcel(selectedFile).then(({ headers: parsedHeaders, rows }) => {
        processFile(parsedHeaders, rows);
      }).catch(() => {
        toast({
          title: "Parse Error",
          description: "Could not read the Excel file. Please check the file format.",
          variant: "destructive",
        });
      });
    }
  };

  const updateFieldMapping = (csvColumn: string, dbField: string) => {
    setFieldMappings(prev =>
      prev.map(m => (m.csvColumn === csvColumn ? { ...m, dbField } : m))
    );
  };

  const handleDestinationChange = (newDestination: ImportDestination) => {
    setDestination(newDestination);
    // Re-process field mappings if file is already loaded
    if (headers.length > 0) {
      const newConfig = DESTINATION_CONFIGS[newDestination];
      const mappings: FieldMapping[] = headers.map(header => {
        const normalizedHeader = header.toLowerCase().replace(/[_\s-]/g, "");
        const matchedField = newConfig.fields.find(f => {
          const normalizedField = f.value.toLowerCase().replace(/[_\s-]/g, "");
          return normalizedHeader.includes(normalizedField) || normalizedField.includes(normalizedHeader);
        });
        return {
          csvColumn: header,
          dbField: matchedField?.value || "skip",
        };
      });
      setFieldMappings(mappings);
    }
  };

  const handleImport = async () => {
    if (csvData.length === 0) {
      toast({
        title: "No Data",
        description: "Please load a file first.",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setImportResults(null);

    const results = { success: 0, failed: 0, errors: [] as string[] };

    try {
      const user = await getAuthUser();
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please log in to import data.",
          variant: "destructive",
        });
        setImporting(false);
        return;
      }

      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        const recordData: Record<string, any> = {
          user_id: user.id,
        };

        // Map CSV values to database fields
        fieldMappings.forEach(mapping => {
          if (mapping.dbField !== "skip" && row[mapping.csvColumn]) {
            let value: any = row[mapping.csvColumn];
            
            // Convert numeric fields based on destination
            const numericFields = getNumericFields(destination);
            if (numericFields.includes(mapping.dbField)) {
              value = parseFloat(value.replace(/[,$]/g, "")) || null;
            }
            
            recordData[mapping.dbField] = value;
          }
        });

        // Handle destination-specific logic
        const insertData = prepareInsertData(destination, recordData, i);

        let error: Error | null = null;
        
        if (destination === "leads") {
          const { error: err } = await ibmDb.from("contact_entities").insert(insertData as any);
          error = err;
        } else if (destination === "lenders") {
          const { error: err } = await ibmDb.from("lenders").insert(insertData as any);
          error = err;
        } else if (destination === "service_providers") {
          const { error: err } = await ibmDb.from("service_providers").insert(insertData as any);
          error = err;
        }

        if (error) {
          results.failed++;
          if (results.errors.length < 5) {
            results.errors.push(`Row ${i + 1}: ${error.message}`);
          }
        } else {
          results.success++;
        }
      }

      setImportResults(results);

      toast({
        title: "Import Complete",
        description: `Successfully imported ${results.success} of ${csvData.length} records to ${currentConfig.label}.`,
        variant: results.failed > 0 ? "destructive" : "default",
      });

      if (onImportComplete) {
        onImportComplete();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Import Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const getNumericFields = (dest: ImportDestination): string[] => {
    switch (dest) {
      case "leads":
        return ["loan_amount", "annual_revenue", "credit_score", "years_in_business"];
      case "lenders":
        return ["min_loan_amount", "max_loan_amount", "interest_rate_min", "interest_rate_max"];
      case "service_providers":
        return [];
      default:
        return [];
    }
  };

  const prepareInsertData = (dest: ImportDestination, data: Record<string, any>, index: number): Record<string, any> => {
    switch (dest) {
      case "leads":
        if (!data.name && (data.first_name || data.last_name)) {
          data.name = `${data.first_name || ""} ${data.last_name || ""}`.trim();
        }
        if (!data.email) {
          data.email = `import-${Date.now()}-${index}@placeholder.com`;
        }
        if (!data.name) {
          data.name = data.email.split("@")[0];
        }
        return data;
      
      case "lenders":
        if (!data.name) {
          data.name = `Lender ${Date.now()}-${index}`;
        }
        if (!data.status) {
          data.status = "active";
        }
        return data;
      
      case "service_providers":
        if (!data.name) {
          data.name = `Provider ${Date.now()}-${index}`;
        }
        if (!data.provider_type) {
          data.provider_type = "title";
        }
        if (!data.status) {
          data.status = "active";
        }
        return data;
      
      default:
        return data;
    }
  };

  const resetImporter = () => {
    setFile(null);
    setFileType(null);
    setCsvData([]);
    setHeaders([]);
    setFieldMappings([]);
    setImportResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Destination Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Import Destination
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select where you want to import your data:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(Object.entries(DESTINATION_CONFIGS) as [ImportDestination, DestinationConfig][]).map(([key, config]) => (
              <div
                key={key}
                onClick={() => handleDestinationChange(key)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  destination === key
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <h3 className="font-semibold">{config.label}</h3>
                <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload File
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Supported formats:</span>
            <Badge variant="outline" className="gap-1">
              <FileText className="h-3 w-3" />
              CSV
            </Badge>
            <Badge variant="outline" className="gap-1">
              <FileSpreadsheet className="h-3 w-3" />
              Excel (.xlsx, .xls)
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              id="data-upload"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Select File
            </Button>
            {file && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-green-600" />
                {file.name} ({csvData.length} rows)
              </div>
            )}
            {file && (
              <Button variant="ghost" size="sm" onClick={resetImporter}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Field Mapping */}
      {headers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Map Columns to {currentConfig.label} Fields</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fieldMappings.map(mapping => (
                <div key={mapping.csvColumn} className="flex flex-col gap-2">
                  <label className="text-sm font-medium">{mapping.csvColumn}</label>
                  <Select
                    value={mapping.dbField}
                    onValueChange={(value) => updateFieldMapping(mapping.csvColumn, value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currentConfig.fields.map(field => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {csvData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Data Preview (First 5 rows)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {headers.map(header => (
                      <TableHead key={header}>{header}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvData.slice(0, 5).map((row, index) => (
                    <TableRow key={index}>
                      {headers.map(header => (
                        <TableCell key={header}>{row[header]}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Results */}
      {importResults && (
        <Alert variant={importResults.failed > 0 ? "destructive" : "default"}>
          <AlertDescription>
            <div className="flex items-center gap-4">
              {importResults.failed > 0 ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <Check className="h-5 w-5 text-green-600" />
              )}
              <div>
                <p className="font-medium">
                  Imported {importResults.success} of {csvData.length} records to {currentConfig.label}
                </p>
                {importResults.errors.length > 0 && (
                  <ul className="text-sm mt-2">
                    {importResults.errors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Import Button */}
      {csvData.length > 0 && (
        <div className="flex justify-end">
          <Button
            onClick={handleImport}
            disabled={importing}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import {csvData.length} Records to {currentConfig.label}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
