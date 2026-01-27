import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

import { Download, ExternalLink, FileText, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LeadDocument } from '@/hooks/useDocuments';

// Adobe DC View SDK types
declare global {
  interface Window {
    AdobeDC?: {
      View: new (config: { clientId: string; divId: string }) => {
        previewFile: (
          fileConfig: {
            content:
              | { location: { url: string } }
              | { promise: Promise<ArrayBuffer> };
            metaData: { fileName: string };
          },
          viewerConfig: {
            embedMode: string;
            showAnnotationTools: boolean;
            showLeftHandPanel: boolean;
            showDownloadPDF: boolean;
            showPrintPDF: boolean;
            showTopToolbar: boolean;
            defaultViewMode: string;
          }
        ) => void;
      };
    };
  }
}

interface DocumentViewerProps {
  document: LeadDocument | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DocumentViewer({ document, isOpen, onClose }: DocumentViewerProps) {
  const [loading, setLoading] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [viewerError, setViewerError] = useState(false);
  const [adobeConfig, setAdobeConfig] = useState<{
    clientId: string; 
    isDemo: boolean;
    hasApiKey?: boolean;
    status?: string;
    features?: any;
  } | null>(null);
  const [adobeView, setAdobeView] = useState<any>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Determine file types
  const isPdf = document?.file_mime_type?.includes('pdf') || document?.document_name?.toLowerCase().endsWith('.pdf');
  const isWordDoc = document?.file_mime_type?.includes('word') || 
                   document?.file_mime_type?.includes('document') ||
                   document?.document_name?.toLowerCase().match(/\.(doc|docx)$/);
  const isImage = document?.file_mime_type?.startsWith('image/');

  const getDocumentUrl = async (filePath: string) => {
    try {
      setLoading(true);
      console.log('Getting document URL for:', filePath);

      const isPdfPath = filePath.toLowerCase().endsWith('.pdf');

      // For PDFs intended for Adobe viewer, prefer a signed URL first
      if (isPdfPath) {
        try {
          console.log('Attempting signed URL first for PDF...');
          const { data: signed, error: signedError } = await supabase.storage
            .from('lead-documents')
            .createSignedUrl(filePath, 3600);

          if (!signedError && signed?.signedUrl) {
            console.log('Using signed URL for Adobe viewer');
            setDocumentUrl(signed.signedUrl);
            return signed.signedUrl;
          }
          console.warn('Signed URL failed, falling back to download for PDF');
        } catch (e) {
          console.warn('Signed URL attempt threw, trying download for PDF');
        }
      }

      // Download and create a blob URL (works well for images/others)
      try {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('lead-documents')
          .download(filePath);

        if (!downloadError && fileData) {
          console.log('Successfully downloaded file, creating blob URL');
          const blobUrl = URL.createObjectURL(fileData);
          setDocumentUrl(blobUrl);
          return blobUrl;
        }
      } catch (e) {
        console.log('Download method failed, trying signed URL');
      }
      
      // Try signed URL (for non-PDF or download fallback)
      const { data: signed, error: signedError } = await supabase.storage
        .from('lead-documents')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (!signedError && signed?.signedUrl) {
        console.log('Successfully got signed URL');
        setDocumentUrl(signed.signedUrl);
        return signed.signedUrl;
      }
      
      // Final fallback to public URL (may be disabled)
      const publicUrl = `https://gshxxsniwytjgcnthyfq.supabase.co/storage/v1/object/public/lead-documents/${filePath}`;
      console.log('Trying public URL as fallback:', publicUrl);
      try {
        const response = await fetch(publicUrl, { method: 'HEAD' });
        if (response.ok) {
          console.log('Public URL works, using it');
          setDocumentUrl(publicUrl);
          return publicUrl;
        }
      } catch (e) {
        console.log('Public URL failed as expected for private bucket');
      }

      return null;
    } catch (error) {
      console.error('Error getting document URL:', error);
      toast({
        title: "Error",
        description: "Failed to load document. You can still download it.",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Get Adobe configuration
  const getAdobeConfig = async () => {
    try {
      console.log('🔍 Fetching Adobe configuration from edge function...');
      const { data, error } = await supabase.functions.invoke('get-adobe-config');
      
      if (error) {
        console.error('❌ Error from get-adobe-config edge function:', error);
        throw error;
      }
      
      console.log('✅ Adobe config retrieved successfully:', data);
      console.log('📋 Client ID:', data?.clientId);
      console.log('🎯 Is Demo:', data?.isDemo);
      console.log('🔑 Has API Key:', data?.hasApiKey);
      
      setAdobeConfig(data);
      return data;
    } catch (error) {
      console.error('❌ Failed to get Adobe config, using demo fallback:', error);
      // Fallback to demo config
      const fallbackConfig = { clientId: 'dc-pdf-embed-demo', isDemo: true };
      setAdobeConfig(fallbackConfig);
      return fallbackConfig;
    }
  };

  // Load Adobe PDF SDK
  const loadAdobeSDK = () => {
    return new Promise<void>((resolve, reject) => {
      if (window.AdobeDC) {
        console.log('✅ Adobe SDK already loaded');
        resolve();
        return;
      }

      console.log('📦 Loading Adobe PDF SDK...');
      
      // Check if script already exists
      const existingScript = window.document.querySelector('script[src*="acrobatservices.adobe.com"]');
      if (existingScript) {
        console.log('🔄 Adobe script tag already exists, waiting for load...');
        const checkExisting = setInterval(() => {
          if (window.AdobeDC) {
            console.log('✅ Existing Adobe SDK ready');
            clearInterval(checkExisting);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkExisting);
          reject(new Error('Existing Adobe SDK timeout'));
        }, 10000);
        return;
      }

      const script = window.document.createElement('script');
      script.src = 'https://acrobatservices.adobe.com/view-sdk/viewer.js';
      script.async = true;
      
      // Set a timeout for the script loading
      const timeout = setTimeout(() => {
        console.error('❌ Adobe SDK loading timeout - check network/CSP');
        script.remove();
        reject(new Error('Adobe SDK loading timeout - network issue or blocked by CSP'));
      }, 15000); // 15 second timeout
      
      script.onload = () => {
        clearTimeout(timeout);
        console.log('✅ Adobe PDF SDK script loaded successfully');
        
        // Check if AdobeDC is immediately available
        if (window.AdobeDC) {
          console.log('✅ Adobe SDK ready immediately after load');
          resolve();
          return;
        }
        
        // Wait for Adobe SDK to initialize
        let attempts = 0;
        const checkInterval = setInterval(() => {
          attempts++;
          console.log(`🔄 Checking Adobe SDK availability (attempt ${attempts})`);
          
          if (window.AdobeDC) {
            console.log(`✅ Adobe SDK ready after ${attempts} attempts`);
            clearInterval(checkInterval);
            resolve();
          } else if (attempts > 30) { // 15 seconds total (500ms * 30)
            console.error('❌ Adobe SDK initialization timeout after script load');
            clearInterval(checkInterval);
            reject(new Error('Adobe SDK failed to initialize - possible Client ID issue'));
          }
        }, 500);
      };
      
      script.onerror = (error) => {
        clearTimeout(timeout);
        console.error('❌ Failed to load Adobe PDF SDK script:', error);
        script.remove();
        reject(new Error('Failed to load Adobe PDF SDK - network or CSP blocking'));
      };
      
      console.log('🚀 Adding Adobe script to document head...');
      window.document.head.appendChild(script);
    });
  };

  // Initialize Adobe PDF Viewer
  const initializeAdobeViewer = async (url: string) => {
    try {
      console.log('🚀 === Adobe Viewer Initialization Started ===');
      console.log('📄 PDF URL:', url);
      setViewerError(false); // Reset error state
      
      let config = adobeConfig;
      if (!config) {
        console.log('⚙️ No config in state, fetching Adobe config...');
        config = await getAdobeConfig();
        if (!config) {
          console.error('❌ Adobe configuration unavailable');
          throw new Error('Adobe configuration unavailable');
        }
      } else {
        console.log('✅ Using cached Adobe config:', config);
      }

      console.log('📦 Loading Adobe SDK...');
      await loadAdobeSDK();

      if (!window.AdobeDC) {
        console.error('❌ Adobe SDK failed to load - window.AdobeDC is undefined');
        throw new Error('Adobe SDK failed to load');
      }
      console.log('✅ Adobe SDK loaded successfully');

      if (!viewerRef.current) {
        console.error('❌ Viewer container not ready');
        throw new Error('Viewer container not ready');
      }
      console.log('✅ Viewer container ready');

      // Setup container - clear safely
      viewerRef.current.id = 'adobe-dc-view';
      while (viewerRef.current.firstChild) {
        viewerRef.current.removeChild(viewerRef.current.firstChild);
      }
      console.log('🧹 Viewer container cleared');

      // Wait for DOM updates
      await new Promise(resolve => setTimeout(resolve, 200));

      console.log('🎨 Creating Adobe DC View with Client ID:', config.clientId);
      const adobeDCView = new window.AdobeDC.View({
        clientId: config.clientId,
        divId: 'adobe-dc-view'
      });
      console.log('✅ Adobe DC View instance created');

      // Preview file with error handling - try ArrayBuffer first for CORS issues
      try {
        console.log('📖 Attempting PDF preview with ArrayBuffer for CORS compatibility...');
        
        // Fetch the PDF as ArrayBuffer to avoid CORS issues
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        console.log('✅ PDF fetched as ArrayBuffer, size:', arrayBuffer.byteLength);
        
        adobeDCView.previewFile({
          content: { promise: Promise.resolve(arrayBuffer) },
          metaData: { fileName: document?.document_name || 'document.pdf' }
        }, {
          embedMode: 'SIZED_CONTAINER',
          showAnnotationTools: false,
          showLeftHandPanel: true,
          showDownloadPDF: true,
          showPrintPDF: true,
          showTopToolbar: true,
          defaultViewMode: 'FIT_PAGE'
        });
        console.log('✅ Adobe PDF viewer initialized with ArrayBuffer');
        
      } catch (arrayBufferError) {
        console.warn('⚠️ ArrayBuffer method failed, trying URL method:', arrayBufferError);
        
        // Fallback to URL method
        try {
          adobeDCView.previewFile({
            content: { location: { url } },
            metaData: { fileName: document?.document_name || 'document.pdf' }
          }, {
            embedMode: 'SIZED_CONTAINER',
            showAnnotationTools: false,
            showLeftHandPanel: true,
            showDownloadPDF: true,
            showPrintPDF: true,
            showTopToolbar: true,
            defaultViewMode: 'FIT_PAGE'
          });
          console.log('✅ Adobe PDF viewer initialized with URL fallback');
        } catch (urlError) {
          console.error('❌ Both ArrayBuffer and URL methods failed:', urlError);
          throw new Error('Failed to preview PDF with both methods');
        }
      }

      setAdobeView(adobeDCView);
      console.log('✅ Adobe PDF viewer initialized successfully');
      
    } catch (error) {
      console.error('❌ Adobe viewer initialization failed:', error);
      console.error('Error details:', {
        message: (error as Error).message,
        stack: (error as Error).stack
      });
      setViewerError(true);
      
      console.log('⚠️ Falling back to browser PDF viewer');
    }
  };

  const downloadDocument = async () => {
    if (!document?.file_path) return;

    try {
      console.log('Downloading document:', document.file_path);
      const { data, error } = await supabase.storage
        .from('lead-documents')
        .download(document.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.document_name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Document downloaded successfully",
      });
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: "Error",
        description: "Failed to download document",
        variant: "destructive",
      });
    }
  };

  const openInNewTab = async () => {
    if (!document?.file_path) return;
    
    const url = await getDocumentUrl(document.file_path);
    if (url) {
      window.open(url, '_blank');
    }
  };

  // Load document URL when modal opens
  useEffect(() => {
    if (isOpen && document?.file_path && !documentUrl) {
      getDocumentUrl(document.file_path);
    }
    if (!isOpen) {
      setDocumentUrl(null);
      setViewerError(false);
      setAdobeView(null);
      // Clear Adobe viewer container safely
      if (viewerRef.current) {
        while (viewerRef.current.firstChild) {
          viewerRef.current.removeChild(viewerRef.current.firstChild);
        }
      }
    }
  }, [isOpen, document?.file_path, documentUrl]);

  // Initialize Adobe viewer when document URL is ready
  useEffect(() => {
    if (isOpen && documentUrl && isPdf && !viewerError && !adobeView) {
      console.log('🎯 Conditions met for Adobe viewer initialization:');
      console.log('- Modal open:', isOpen);
      console.log('- Document URL ready:', !!documentUrl);
      console.log('- Is PDF:', isPdf);
      console.log('- No viewer error:', !viewerError);
      console.log('- No existing Adobe view:', !adobeView);
      console.log('📄 Document URL:', documentUrl);
      console.log('🚀 Starting Adobe viewer initialization...');
      initializeAdobeViewer(documentUrl);
    } else {
      console.log('❌ Adobe viewer conditions not met:');
      console.log('- Modal open:', isOpen);
      console.log('- Document URL ready:', !!documentUrl);
      console.log('- Is PDF:', isPdf);
      console.log('- No viewer error:', !viewerError);
      console.log('- No existing Adobe view:', !adobeView);
    }
  }, [isOpen, documentUrl, isPdf, viewerError, adobeView]);

  // Helper function to format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size'
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  };

  if (!document) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] w-[90vw]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold">
                {document.document_name}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs">
                  {document.document_type}
                </span>
                <span className="text-xs">
                  {document.file_mime_type || 'Unknown type'}
                </span>
                <span className="text-xs">
                  {formatFileSize(document.file_size)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadDocument}
                className="gap-1"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={openInNewTab}
                className="gap-1"
              >
                <ExternalLink className="h-4 w-4" />
                Open in Browser
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="gap-1"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2">Loading document...</span>
            </div>
          ) : documentUrl ? (
            <div className="h-[70vh] border rounded-lg overflow-hidden relative">
              {isPdf ? (
                <div className="w-full h-full bg-gray-50 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium">PDF Document</span>
                      <span className="text-xs text-muted-foreground">
                        Adobe PDF Embed {adobeConfig?.isDemo ? '(Demo)' : '(Licensed)'}
                        {viewerError && ' - Error, showing browser fallback'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={downloadDocument}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                    </div>
                  </div>
                  
                  {/* Adobe PDF Embed SDK Viewer */}
                  <div className="flex-1">
                    {viewerError ? (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50">
                        <div className="text-center space-y-4">
                          <div className="w-20 h-24 bg-gradient-to-b from-red-50 to-red-100 rounded-lg flex items-center justify-center mx-auto border-2 border-red-200">
                            <FileText className="h-10 w-10 text-red-600" />
                          </div>
                          <div>
                            <h3 className="font-medium text-lg">Adobe PDF Viewer Error</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              The Adobe PDF viewer encountered an issue. Check browser console for details.
                            </p>
                          </div>
                          <div className="flex gap-2 justify-center">
                            <Button onClick={() => window.open(documentUrl, '_blank')} className="gap-2">
                              <ExternalLink className="h-4 w-4" />
                              Open PDF in Browser
                            </Button>
                            <Button variant="outline" onClick={downloadDocument} className="gap-2">
                              <Download className="h-4 w-4" />
                              Download PDF
                            </Button>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={async () => {
                              console.log('🔄 Manual retry requested - resetting all states...');
                              setViewerError(false);
                              setAdobeView(null);
                              setAdobeConfig(null);
                              
                              // Clear any existing Adobe elements
                              const existingViewer = window.document.getElementById('adobe-dc-view');
                              if (existingViewer) {
                                while (existingViewer.firstChild) {
                                  existingViewer.removeChild(existingViewer.firstChild);
                                }
                              }
                              
                              console.log('🔄 Fetching fresh Adobe config...');
                              const newConfig = await getAdobeConfig();
                              console.log('📋 Fresh config received:', newConfig);
                              
                              if (documentUrl) {
                                console.log('🚀 Retrying Adobe viewer with fresh config...');
                                initializeAdobeViewer(documentUrl);
                              }
                            }}
                            className="gap-1"
                          >
                            <Loader2 className="h-3 w-3" />
                            Retry Adobe Viewer
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        id="adobe-dc-view" 
                        ref={viewerRef}
                        className="w-full h-full"
                        style={{ minHeight: '500px' }}
                      />
                    )}
                  </div>
                </div>
              ) : isImage ? (
                <div className="w-full h-full flex items-center justify-center bg-muted/50">
                  <img
                    src={documentUrl}
                    alt={document.document_name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : isWordDoc ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50">
                  <div className="text-center space-y-4">
                    <div className="w-20 h-24 bg-gradient-to-b from-blue-50 to-blue-100 rounded-lg flex items-center justify-center mx-auto border-2 border-blue-200">
                      <FileText className="h-10 w-10 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-lg">{document.document_name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatFileSize(document.file_size)} • Word Document
                      </p>
                    </div>
                    <p className="text-muted-foreground max-w-md">
                      Word documents cannot be previewed directly. Click "Open in Browser" to view or download the file.
                    </p>
                    <div className="flex gap-2">
                      <Button onClick={() => window.open(documentUrl, '_blank')} className="gap-2">
                        <ExternalLink className="h-4 w-4" />
                        Open in Browser
                      </Button>
                      <Button variant="outline" onClick={downloadDocument} className="gap-2">
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50">
                  <div className="text-center space-y-4">
                    <div className="w-20 h-24 bg-gradient-to-b from-gray-50 to-gray-100 rounded-lg flex items-center justify-center mx-auto border-2 border-gray-200">
                      <FileText className="h-10 w-10 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-lg">{document.document_name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatFileSize(document.file_size)} • {document.file_mime_type || 'Unknown type'}
                      </p>
                    </div>
                    <p className="text-muted-foreground max-w-md">
                      This file type cannot be previewed directly. You can download or try opening in a new tab.
                    </p>
                    <div className="flex gap-2">
                      <Button onClick={downloadDocument} className="gap-2">
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                      <Button variant="outline" onClick={() => window.open(documentUrl, '_blank')} className="gap-2">
                        <ExternalLink className="h-4 w-4" />
                        Try in Browser
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-96">
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">Failed to load document</p>
                <Button onClick={() => document?.file_path && getDocumentUrl(document.file_path)} variant="outline">
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>

        {document.notes && (
          <div className="border-t pt-4">
            <div className="text-sm text-muted-foreground mb-1">Notes:</div>
            <div className="text-sm">{document.notes}</div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}