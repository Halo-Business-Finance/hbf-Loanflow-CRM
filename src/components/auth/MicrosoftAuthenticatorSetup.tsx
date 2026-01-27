import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { QrCode, Shield, Smartphone, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EnhancedMFA } from '@/lib/enhanced-mfa';
import { useAuth } from '@/components/auth/AuthProvider';
import { useMfaStatus } from '@/hooks/useMfaStatus';
import QRCodeLib from 'qrcode';

interface SetupStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

export const MicrosoftAuthenticatorSetup: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string>('');
  const [qrCodeImageUrl, setQrCodeImageUrl] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const { toast } = useToast();
  const { user } = useAuth();
  const { markMfaCompleted } = useMfaStatus(user?.id);

  const steps: SetupStep[] = [
    {
      id: 1,
      title: 'Generate QR Code',
      description: 'Create your unique Microsoft Authenticator setup code',
      completed: qrCodeData !== ''
    },
    {
      id: 2,
      title: 'Scan with Microsoft Authenticator',
      description: 'Use Microsoft Authenticator app to scan the QR code',
      completed: currentStep > 2
    },
    {
      id: 3,
      title: 'Verify Setup',
      description: 'Enter the 6-digit code from your authenticator app',
      completed: isVerified
    },
    {
      id: 4,
      title: 'Save Backup Codes',
      description: 'Store your backup codes in a secure location',
      completed: isVerified && backupCodes.length > 0
    }
  ];

  const generateSetup = async () => {
    if (!user?.id) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "User not authenticated"
      });
      return;
    }

    setIsLoading(true);
    try {
      const setup = await EnhancedMFA.generateTOTPSecret(user.id);
      setQrCodeData(setup.qrCode);
      setSecret(setup.secret);
      setBackupCodes(setup.backupCodes);
      setCurrentStep(2);
      
      toast({
        title: "Setup Generated",
        description: "QR code and backup codes have been generated"
      });
    } catch (error) {
      console.error('Setup generation failed:', error);
      toast({
        variant: "destructive",
        title: "Setup Failed",
        description: "Failed to generate Microsoft Authenticator setup"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const verifySetup = async () => {
    if (!user?.id || !verificationCode) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter the verification code"
      });
      return;
    }

    setIsLoading(true);
    try {
      const isValid = await EnhancedMFA.verifyTOTP(user.id, verificationCode);
      
      if (isValid) {
        // Mark MFA as completed in the database
        await markMfaCompleted();
        
        setIsVerified(true);
        setCurrentStep(4);
        toast({
          title: "Verification Successful",
          description: "Microsoft Authenticator has been successfully configured"
        });
      } else {
        toast({
          variant: "destructive",
          title: "Verification Failed",
          description: "Invalid code. Please try again."
        });
      }
    } catch (error) {
      console.error('Verification failed:', error);
      toast({
        variant: "destructive",
        title: "Verification Error",
        description: "Failed to verify the code"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Generate QR code image when qrCodeData changes
  useEffect(() => {
    if (qrCodeData) {
      QRCodeLib.toDataURL(qrCodeData, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
        .then(url => setQrCodeImageUrl(url))
        .catch(err => {
          console.error('QR code generation failed:', err);
          toast({
            variant: "destructive",
            title: "QR Code Error",
            description: "Failed to generate QR code image"
          });
        });
    }
  }, [qrCodeData, toast]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Microsoft Authenticator Setup</CardTitle>
          <CardDescription>
            Secure your account with time-based one-time passwords (TOTP) using Microsoft Authenticator
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Step Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${step.completed 
                      ? 'bg-primary text-primary-foreground' 
                      : currentStep === step.id 
                        ? 'bg-primary/20 text-primary border-2 border-primary' 
                        : 'bg-muted text-muted-foreground border border-border'
                    }
                  `}>
                    {step.completed ? <CheckCircle className="w-4 h-4" /> : step.id}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`
                      flex-1 h-0.5 mx-2
                      ${step.completed ? 'bg-primary' : 'bg-border'}
                    `} />
                  )}
                </div>
              ))}
            </div>
            <div className="text-center">
              <h3 className="font-medium text-foreground">{steps[currentStep - 1]?.title}</h3>
              <p className="text-sm text-muted-foreground">{steps[currentStep - 1]?.description}</p>
            </div>
          </div>

          {/* Step 1: Generate Setup */}
          {currentStep === 1 && (
            <div className="text-center space-y-4">
              <Alert>
                <Smartphone className="h-4 w-4" />
                <AlertDescription>
                  Make sure you have Microsoft Authenticator installed on your mobile device before proceeding.
                </AlertDescription>
              </Alert>
              <Button 
                onClick={generateSetup} 
                disabled={isLoading}
                size="lg"
                className="w-full"
              >
                {isLoading ? 'Generating...' : 'Generate Microsoft Authenticator Setup'}
              </Button>
            </div>
          )}

          {/* Step 2: Show QR Code */}
          {currentStep === 2 && qrCodeData && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-medium mb-4 text-foreground">Scan QR Code with Microsoft Authenticator</h3>
                <div className="flex justify-center mb-4">
                  {qrCodeImageUrl ? (
                    <img 
                      src={qrCodeImageUrl} 
                      alt="MFA QR Code" 
                      className="w-64 h-64 border-2 border-border rounded-lg"
                    />
                  ) : (
                    <div className="w-64 h-64 bg-muted border-2 border-border rounded-lg flex items-center justify-center">
                      <QrCode className="w-16 h-16 text-muted-foreground animate-pulse" />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Or enter this secret key manually:
                  </p>
                  <div className="bg-muted p-3 rounded-lg border border-border">
                    <code className="text-sm font-mono break-all text-foreground">{secret}</code>
                  </div>
                </div>
              </div>
              <Button 
                onClick={() => setCurrentStep(3)}
                className="w-full"
              >
                I've Added the Account
              </Button>
            </div>
          )}

          {/* Step 3: Verify Setup */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="verification-code" className="text-foreground">Enter 6-digit code from Microsoft Authenticator</Label>
                <Input
                  id="verification-code"
                  type="text"
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="text-center text-2xl tracking-wider bg-background text-foreground border-border"
                />
              </div>
              <Button 
                onClick={verifySetup}
                disabled={isLoading || verificationCode.length !== 6}
                className="w-full"
              >
                {isLoading ? 'Verifying...' : 'Verify Code'}
              </Button>
            </div>
          )}

          {/* Step 4: Backup Codes */}
          {currentStep === 4 && isVerified && (
            <div className="space-y-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Save these backup codes in a secure location. You can use them to access your account if you lose your device.
                </AlertDescription>
              </Alert>
              <div className="bg-muted p-4 rounded-lg border border-border">
                <h4 className="font-medium mb-3 text-foreground">Backup Recovery Codes</h4>
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code, index) => (
                    <div key={index} className="bg-card p-2 rounded border border-border">
                      <code className="text-sm text-foreground">{code}</code>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    const codesText = backupCodes.join('\n');
                    navigator.clipboard.writeText(codesText);
                    toast({
                      title: "Copied to Clipboard",
                      description: "Backup codes have been copied to your clipboard"
                    });
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Copy Codes
                </Button>
                <Button 
                  onClick={() => {
                    const dataStr = `data:text/plain;charset=utf-8,${encodeURIComponent(backupCodes.join('\n'))}`;
                    const downloadAnchorNode = document.createElement('a');
                    downloadAnchorNode.setAttribute("href", dataStr);
                    downloadAnchorNode.setAttribute("download", "microsoft-authenticator-backup-codes.txt");
                    document.body.appendChild(downloadAnchorNode);
                    downloadAnchorNode.click();
                    downloadAnchorNode.remove();
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Download
                </Button>
              </div>
              
              {isVerified && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Microsoft Authenticator has been successfully configured for your account!
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};