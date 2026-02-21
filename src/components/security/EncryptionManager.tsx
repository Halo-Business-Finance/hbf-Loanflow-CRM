import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Shield, 
  Key, 
  Lock, 
  Unlock, 
  RefreshCw,
  Plus,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle
} from "lucide-react"
import { AdvancedEncryption, type EncryptedData } from "@/lib/advanced-encryption"
import { ibmDb } from "@/lib/ibm"
import { useToast } from "@/hooks/use-toast"

export function EncryptionManager() {
  const { toast } = useToast()
  const [encryptionKeys, setEncryptionKeys] = useState<any[]>([])
  const [encryptedFields, setEncryptedFields] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showDecrypted, setShowDecrypted] = useState<{[key: string]: boolean}>({})

  // Encryption form state
  const [encryptForm, setEncryptForm] = useState({
    data: '',
    tableName: '',
    fieldName: '',
    recordId: ''
  })

  // Decryption form state
  const [decryptForm, setDecryptForm] = useState({
    tableName: '',
    fieldName: '',
    recordId: ''
  })

  const [encryptionResult, setEncryptionResult] = useState<EncryptedData | null>(null)
  const [decryptionResult, setDecryptionResult] = useState<string | null>(null)

  useEffect(() => {
    loadEncryptionKeys()
    loadEncryptedFields()
  }, [])

  const loadEncryptionKeys = async () => {
    try {
      const { data, error } = await ibmDb
        .from('encryption_keys')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setEncryptionKeys(data || [])
    } catch (error) {
      console.error('Failed to load encryption keys:', error)
      toast({
        title: "Error",
        description: "Failed to load encryption keys",
        variant: "destructive",
      })
    }
  }

  const loadEncryptedFields = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await ibmDb
        .from('encrypted_fields')
        .select(`
          *,
          encryption_keys!encryption_key_id (
            key_name,
            algorithm,
            key_purpose
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setEncryptedFields(data || [])
    } catch (error) {
      console.error('Failed to load encrypted fields:', error)
      toast({
        title: "Error",
        description: "Failed to load encrypted fields",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const createEncryptionKey = async () => {
    try {
      const keyName = `encryption_key_${Date.now()}`
      
      const { error } = await ibmDb
        .from('encryption_keys')
        .insert({
          key_name: keyName,
          key_purpose: 'field_encryption',
          algorithm: 'AES-256-GCM'
        })

      if (error) throw error

      toast({
        title: "Success",
        description: "New encryption key created successfully",
      })

      await loadEncryptionKeys()
    } catch (error) {
      console.error('Failed to create encryption key:', error)
      toast({
        title: "Error",
        description: "Failed to create encryption key",
        variant: "destructive",
      })
    }
  }

  const encryptField = async () => {
    if (!encryptForm.data || !encryptForm.tableName || !encryptForm.fieldName || !encryptForm.recordId) {
      toast({
        title: "Error",
        description: "All fields are required for encryption",
        variant: "destructive",
      })
      return
    }

    try {
      setIsLoading(true)
      const result = await AdvancedEncryption.encryptField(
        encryptForm.data,
        encryptForm.tableName,
        encryptForm.fieldName,
        encryptForm.recordId
      )

      setEncryptionResult(result)
      
      toast({
        title: "Success",
        description: "Data encrypted successfully",
      })

      // Clear form
      setEncryptForm({
        data: '',
        tableName: '',
        fieldName: '',
        recordId: ''
      })

      await loadEncryptedFields()
    } catch (error) {
      console.error('Encryption failed:', error)
      toast({
        title: "Error",
        description: "Failed to encrypt data",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const decryptField = async () => {
    if (!decryptForm.tableName || !decryptForm.fieldName || !decryptForm.recordId) {
      toast({
        title: "Error",
        description: "All fields are required for decryption",
        variant: "destructive",
      })
      return
    }

    try {
      setIsLoading(true)
      const result = await AdvancedEncryption.decryptField(
        decryptForm.tableName,
        decryptForm.fieldName,
        decryptForm.recordId
      )

      setDecryptionResult(result)
      
      if (result) {
        toast({
          title: "Success",
          description: "Data decrypted successfully",
        })
      } else {
        toast({
          title: "Warning",
          description: "No encrypted data found for the specified field",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Decryption failed:', error)
      toast({
        title: "Error",
        description: "Failed to decrypt data",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const toggleDecryptedView = async (fieldId: string) => {
    const field = encryptedFields.find(f => f.id === fieldId)
    if (!field) return

    if (showDecrypted[fieldId]) {
      // Hide decrypted data
      setShowDecrypted(prev => ({ ...prev, [fieldId]: false }))
    } else {
      // Show decrypted data
      try {
        const decrypted = await AdvancedEncryption.decryptField(
          field.table_name,
          field.field_name,
          field.record_id
        )
        
        setShowDecrypted(prev => ({ ...prev, [fieldId]: true }))
        
        // Store decrypted value temporarily
        setEncryptedFields(prev => prev.map(f => 
          f.id === fieldId ? { ...f, decrypted_value: decrypted } : f
        ))
      } catch (error) {
        console.error('Failed to decrypt field:', error)
        toast({
          title: "Error",
          description: "Failed to decrypt field data",
          variant: "destructive",
        })
      }
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Military-Grade Encryption Manager
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Shield className="w-4 h-4" />
            <AlertDescription>
              This system uses AES-256-GCM encryption with PBKDF2 key derivation for military-grade security.
              All sensitive data is encrypted at rest and in transit.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Tabs defaultValue="encrypt" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="encrypt">Encrypt</TabsTrigger>
          <TabsTrigger value="decrypt">Decrypt</TabsTrigger>
          <TabsTrigger value="fields">Encrypted Fields</TabsTrigger>
          <TabsTrigger value="keys">Keys</TabsTrigger>
        </TabsList>

        {/* Encryption Tab */}
        <TabsContent value="encrypt" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Encrypt Field Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="encrypt-data">Data to Encrypt</Label>
                  <Input
                    id="encrypt-data"
                    type="text"
                    placeholder="Enter sensitive data..."
                    value={encryptForm.data}
                    onChange={(e) => setEncryptForm(prev => ({ ...prev, data: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="encrypt-table">Table Name</Label>
                  <Input
                    id="encrypt-table"
                    type="text"
                    placeholder="e.g., leads"
                    value={encryptForm.tableName}
                    onChange={(e) => setEncryptForm(prev => ({ ...prev, tableName: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="encrypt-field">Field Name</Label>
                  <Input
                    id="encrypt-field"
                    type="text"
                    placeholder="e.g., social_security_number"
                    value={encryptForm.fieldName}
                    onChange={(e) => setEncryptForm(prev => ({ ...prev, fieldName: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="encrypt-record">Record ID</Label>
                  <Input
                    id="encrypt-record"
                    type="text"
                    placeholder="UUID of the record"
                    value={encryptForm.recordId}
                    onChange={(e) => setEncryptForm(prev => ({ ...prev, recordId: e.target.value }))}
                  />
                </div>
              </div>

              <Button
                onClick={encryptField}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                Encrypt Data
              </Button>

              {encryptionResult && (
                <Alert className="border-green-500">
                  <CheckCircle className="w-4 h-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <div><strong>Encryption Successful!</strong></div>
                      <div className="space-y-1 text-sm">
                        <div><strong>Algorithm:</strong> {encryptionResult.algorithm}</div>
                        <div><strong>Key ID:</strong> {encryptionResult.keyId}</div>
                        <div><strong>Encrypted Value:</strong> 
                          <span className="font-mono break-all">
                            {encryptionResult.encryptedValue.substring(0, 50)}...
                          </span>
                        </div>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Decryption Tab */}
        <TabsContent value="decrypt" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Unlock className="w-5 h-5" />
                Decrypt Field Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="decrypt-table">Table Name</Label>
                  <Input
                    id="decrypt-table"
                    type="text"
                    placeholder="e.g., leads"
                    value={decryptForm.tableName}
                    onChange={(e) => setDecryptForm(prev => ({ ...prev, tableName: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="decrypt-field">Field Name</Label>
                  <Input
                    id="decrypt-field"
                    type="text"
                    placeholder="e.g., social_security_number"
                    value={decryptForm.fieldName}
                    onChange={(e) => setDecryptForm(prev => ({ ...prev, fieldName: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="decrypt-record">Record ID</Label>
                  <Input
                    id="decrypt-record"
                    type="text"
                    placeholder="UUID of the record"
                    value={decryptForm.recordId}
                    onChange={(e) => setDecryptForm(prev => ({ ...prev, recordId: e.target.value }))}
                  />
                </div>
              </div>

              <Button
                onClick={decryptField}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
                Decrypt Data
              </Button>

              {decryptionResult && (
                <Alert className="border-blue-500">
                  <Unlock className="w-4 h-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <div><strong>Decryption Successful!</strong></div>
                      <div className="p-2 bg-muted rounded font-mono">
                        {decryptionResult}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Encrypted Fields Tab */}
        <TabsContent value="fields" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Encrypted Fields Registry
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                  <span className="ml-2">Loading encrypted fields...</span>
                </div>
              ) : encryptedFields.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No encrypted fields found
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {encryptedFields.map((field) => (
                      <div key={field.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="space-y-1">
                            <div className="font-medium">
                              {field.table_name}.{field.field_name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Record: {field.record_id}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{field.encryption_algorithm}</Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleDecryptedView(field.id)}
                            >
                              {showDecrypted[field.id] ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div>
                            <strong>Encrypted Value:</strong>
                            <div className="font-mono text-xs break-all p-2 bg-muted rounded">
                              {field.encrypted_value.substring(0, 100)}...
                            </div>
                          </div>
                          
                          {showDecrypted[field.id] && field.decrypted_value && (
                            <div>
                              <strong>Decrypted Value:</strong>
                              <div className="p-2 bg-green-50 border border-green-200 rounded">
                                {field.decrypted_value}
                              </div>
                            </div>
                          )}
                          
                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <div>Created: {new Date(field.created_at).toLocaleString()}</div>
                            <div>Key: {field.encryption_keys?.key_name}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Keys Tab */}
        <TabsContent value="keys" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Encryption Keys
              </CardTitle>
              <Button onClick={createEncryptionKey} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Create Key
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {encryptionKeys.map((key) => (
                  <div key={key.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-medium">{key.key_name}</div>
                        <div className="text-sm text-muted-foreground">
                          Purpose: {key.key_purpose} | Algorithm: {key.algorithm}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={key.is_active ? "default" : "secondary"}>
                          {key.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <div className="text-sm text-muted-foreground">
                          {new Date(key.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}