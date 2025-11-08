import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePolling } from '../../hooks/usePolling';
import { api, VerificationResult } from '../../services/api';

export function VCVerification() {
  console.log('VCVerification component mounted');
  const { user, refreshUser } = useAuth();
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  
  // Debug QR code state
  console.log('VCVerification render - qrCodeUrl:', qrCodeUrl, 'verification:', verification?.status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Polling for verification status
  const { stop: stopPolling } = usePolling(
    async () => {
      if (!verification?.transactionId) return null;
      
      const response = await api.pollVCVerification(verification.transactionId);
      if (response.error) {
        throw new Error(response.error);
      }
      
      const result = response.data!;
      setVerification(result);
      
      // Preserve qrCodeUrl in separate state
      if (result.qrCodeUrl && !qrCodeUrl) {
        console.log('Setting qrCodeUrl from polling:', result.qrCodeUrl);
        setQrCodeUrl(result.qrCodeUrl);
      }
      
      if (result.status === 'completed') {
        stopPolling();
        // Don't call refreshUser immediately to keep QR code visible
        // await refreshUser();
        setError(null);
      } else if (result.status === 'failed' || result.status === 'expired') {
        stopPolling();
        setError(result.error || '驗證失敗');
      }
      
      return result;
    },
    {
      interval: verification?.pollInterval || 5000,
      enabled: verification?.status === 'pending',
      onError: (err) => {
        setError(err.message);
        stopPolling();
      }
    }
  );

  const startVerification = async () => {
    console.log('startVerification button clicked');
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.startVCVerification();
      if (response.error) {
        throw new Error(response.error);
      }
      
      setVerification(response.data!);
      if (response.data!.qrCodeUrl) {
        console.log('Setting qrCodeUrl from startVerification:', response.data!.qrCodeUrl);
        setQrCodeUrl(response.data!.qrCodeUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '啟動驗證失敗');
    } finally {
      setLoading(false);
    }
  };

  const resetVerification = () => {
    console.log('resetVerification called - clearing qrCodeUrl');
    setVerification(null);
    setQrCodeUrl(null);
    setError(null);
    stopPolling();
  };

  if (!user) {
    console.log('VCVerification: no user, returning null');
    return null;
  }

  if (user.status === 'VERIFIED') {
    console.log('VCVerification: user already verified, showing success message');
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">
              階級卡已驗證
            </h3>
            <div className="mt-1 text-sm text-green-700">
              您的 {user.rank} 等級已確認，可以存取專屬論壇！
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">階級卡驗證</h2>
      
      {!verification ? (
        <div>
          <p className="text-gray-600 mb-4">
            驗證您的階級卡以解鎖專屬論壇和功能。
          </p>
          <button
            onClick={startVerification}
            disabled={loading}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
          >
            {loading ? '啟動中...' : '開始驗證'}
          </button>
        </div>
      ) : (
        <div>
          {/* Debug info */}
          <div className="mb-2 p-2 bg-gray-100 text-xs">
            Debug: qrCodeUrl = {verification.qrCodeUrl ? 'EXISTS' : 'NULL'} | Status = {verification.status}
          </div>
          
          {qrCodeUrl && (
            <div className="mb-4 text-center" style={{position: 'relative', zIndex: 1000}}>
              <p className="text-sm text-gray-600 mb-2">請使用錢包 APP 掃描 QR 碼：</p>
              <div className="flex justify-center">
                <img 
                  src={qrCodeUrl} 
                  alt="VC Verification QR Code"
                  className="w-48 h-48 border rounded-lg"
                  style={{display: 'block !important', visibility: 'visible !important', opacity: '1 !important'}}
                />
              </div>
            </div>
          )}
          
          {verification.status === 'pending' && (
            <div className="text-center">
              <div className="mb-4">
                <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-lg">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  等待驗證中...
                </div>
              </div>
              
              <p className="text-sm text-gray-500 mb-4">
                請在錢包 APP 中完成驗證流程
              </p>
              
              <button
                onClick={resetVerification}
                className="px-4 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                取消驗證
              </button>
            </div>
          )}
          
          {verification.status === 'completed' && (
            <div className="text-center text-green-600">
              <svg className="mx-auto h-12 w-12 text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <h3 className="text-lg font-medium text-green-800 mb-2">驗證成功！</h3>
              <p className="text-sm text-green-700 mb-4">
                您的階級卡已驗證完成，請點擊下方按鈕更新狀態。
              </p>
              <button
                onClick={async () => {
                  await refreshUser();
                  resetVerification();
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                更新我的狀態
              </button>
            </div>
          )}
        </div>
      )}
      
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={resetVerification}
            className="mt-2 px-3 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200"
          >
            重新開始
          </button>
        </div>
      )}
    </div>
  );
}
