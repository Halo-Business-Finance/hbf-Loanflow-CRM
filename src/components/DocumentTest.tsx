import React, { useState, useEffect } from 'react';
import { ibmDb, ibmStorage } from '@/lib/ibm';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function DocumentTest() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [testResult, setTestResult] = useState<string>('');

  const testDocumentAccess = async () => {
    try {
      setTestResult('Testing document access...');
      
      const { data: docs, error: docsError } = await ibmDb
        .from('lead_documents')
        .select('*')
        .limit(1);
      
      if (docsError) {
        setTestResult(`Error fetching documents: ${docsError.message}`);
        return;
      }
      
      if (!docs || docs.length === 0) {
        setTestResult('No documents found in database');
        return;
      }
      
      const doc = docs[0] as any;
      setTestResult(`Found document: ${doc.document_name}`);
      
      if (doc.file_path) {
        try {
          const { data: fileData, error: downloadError } = await ibmStorage
            .from('lead-documents')
            .download(doc.file_path);

          if (downloadError) {
            setTestResult(`Document found but download failed: ${downloadError.message}`);
          } else {
            setTestResult(`✅ SUCCESS: Document is accessible! File size: ${fileData.size} bytes`);
          }
        } catch (e) {
          setTestResult(`Download test failed: ${e}`);
        }
      }
      
    } catch (error) {
      setTestResult(`Test failed: ${error}`);
    }
  };

  useEffect(() => {
    testDocumentAccess();
  }, []);

  return (
    <Card className="m-4">
      <CardContent className="p-6">
        <h2 className="text-xl font-bold mb-4">Document Access Test</h2>
        <div className="space-y-4">
          <div className="p-4 bg-muted rounded">
            <strong>Test Result:</strong>
            <div className="mt-2 font-mono text-sm">{testResult}</div>
          </div>
          <Button onClick={testDocumentAccess}>
            Run Test Again
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
