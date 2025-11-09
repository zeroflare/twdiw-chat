import React, { useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { api, VerificationResult } from '../../services/api';
import { usePolling } from '../../hooks/usePolling';

export function mergeVerificationState(
  previous: VerificationResult | null,
  next: VerificationResult
): VerificationResult {
  if (!previous) {
    return next;
  }

  return {
    ...previous,
    ...next,
    qrCodeUrl: next.qrCodeUrl || previous.qrCodeUrl,
    authUri: next.authUri || previous.authUri,
  };
}

const getRankDisplayName = (rank: string): string => {
  const rankMap: Record<string, string> = {
    'EARTH_OL_GRADUATE': '地球OL財富畢業證書持有者',
    'LIFE_WINNER_S': '人生勝利組S級玩家',
    'QUASI_WEALTHY_VIP': '準富豪VIP登錄證',
    'DISTINGUISHED_PETTY': '尊爵不凡．小資族認證',
    'NEWBIE_VILLAGE': '新手村榮譽村民證'
  };
  return rankMap[rank] || rank;
};

const workflowSteps = [
  {
    title: '啟動驗證',
    description: '建立交易並自 twdiw 驗證端取得 QR Code / Deep Link',
  },
  {
    title: '掃描或開啟皮夾',
    description: '使用 moda 數位憑證皮夾掃描 QR 或點擊 Deep Link',
  },
  {
    title: '等待驗證回覆',
    description: '系統依 workflow 輪詢 twdiw API 並更新會員狀態',
  },
];

export function VCVerification() {
  const { user, refreshUser } = useAuth();
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<'tx' | 'auth' | null>(null);
  const [pollingEnabled, setPollingEnabled] = useState(false);
  const [pollIntervalMs, setPollIntervalMs] = useState(5000);
  const [pollStartTime, setPollStartTime] = useState<number | null>(null);
  const MAX_POLL_DURATION_MS = 5 * 60 * 1000;

  const activeWorkflowStep = useMemo(() => {
    if (error) {
      return 1;
    }

    if (!verification) {
      return 1;
    }

    if (verification.status === 'completed') {
      return 3;
    }

    if (verification.status === 'failed' || verification.status === 'expired') {
      return 1;
    }

    return 2;
  }, [verification, error]);

  const statusMeta = useMemo(() => {
    if (!verification) {
      return { label: '尚未啟動', color: 'bg-gray-100 text-gray-700' };
    }

    switch (verification.status) {
      case 'pending':
        return { label: '等待皮夾回覆', color: 'bg-blue-100 text-blue-700' };
      case 'completed':
        return { label: '皮夾已回傳', color: 'bg-green-100 text-green-700' };
      case 'failed':
        return { label: '驗證失敗', color: 'bg-red-100 text-red-700' };
      case 'expired':
        return { label: '驗證逾時', color: 'bg-yellow-100 text-yellow-700' };
      default:
        return { label: '尚未啟動', color: 'bg-gray-100 text-gray-700' };
    }
  }, [verification]);

  const handleCopy = async (value: string, field: 'tx' | 'auth') => {
    if (!navigator?.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Clipboard failures should not break the workflow UI
    }
  };

  const executePoll = async () => {
      if (!verification?.transactionId) return null;

      if (pollStartTime && Date.now() - pollStartTime > MAX_POLL_DURATION_MS) {
        setPollingEnabled(false);
        setError('查詢逾時，請重新產生 QR Code');
        return null;
      }

      try {
        const response = await api.pollVCVerification(verification.transactionId);
        if (response.error) {
          throw new Error(response.error);
        }

        const result = response.data!;
        setVerification(prev => mergeVerificationState(prev, result));

        if (result.status === 'completed') {
          setPollingEnabled(false);
          setError(null);
          try {
            await refreshUser();
          } catch (err) {
            console.error('Failed to refresh user after VC verification:', err);
          }
          return result;
        }

        if (result.status === 'failed' || result.status === 'expired') {
          setPollingEnabled(false);
          setError(result.error || '驗證失敗');
          return result;
        }

        setPollIntervalMs(prev => Math.min(prev + 2000, 30000)); // Slower increase, max 30s

        return result;
      } catch (err) {
        console.error('Polling error:', err);
        setPollingEnabled(false);
        throw err;
      }
    };

  const { stop: stopPolling } = usePolling(
    executePoll,
    {
      interval: pollIntervalMs,
      enabled: pollingEnabled && verification?.status === 'pending',
      onError: (err) => {
        setError(err.message);
        setPollingEnabled(false);
      },
    }
  );

  const startVerification = async () => {
    setLoading(true);
    setError(null);
    setVerification(null);
    setPollingEnabled(false);
    setPollIntervalMs(5000); // Start with shorter interval
    setPollStartTime(null);
    stopPolling();

    try {
      const response = await api.startVCVerification({ force: true });
      if (response.error) {
        throw new Error(response.error);
      }

      const result = response.data!;
      setVerification(result);
      
      // Auto-start polling immediately after QR code generation
      setPollStartTime(Date.now());
      setPollingEnabled(true);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '啟動驗證失敗');
    } finally {
      setLoading(false);
    }
  };

  const resetVerification = () => {
    setVerification(null);
    setError(null);
    setPollingEnabled(false);
    setPollStartTime(null);
    stopPolling();
  };

  if (!user) {
    return null;
  }

  if (user.status === 'VERIFIED') {
    const rankDisplayName = user.rank ? getRankDisplayName(user.rank) : '已驗證';
    
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">階級卡已驗證</h3>
            <p className="mt-1 text-sm text-green-700">
              您的「{rankDisplayName}」等級已確認，可以存取專屬論壇！
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">階級卡驗證</h2>
            <p className="text-sm text-gray-500 mt-1">
              依照 twdiw 驗證端 workflow（掃描 / Deep Link / 回傳）完成 VC 綁定
            </p>
          </div>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusMeta.color}`}>
            {statusMeta.label}
          </span>
        </div>

        <ol className="space-y-3">
          {workflowSteps.map((step, index) => {
            const stepNumber = index + 1;
            const isCompleted = stepNumber < activeWorkflowStep;
            const isActive = stepNumber === activeWorkflowStep;
            return (
              <li
                key={step.title}
                className={`rounded-lg border p-3 text-sm transition-colors ${
                  isActive
                    ? 'border-primary-200 bg-primary-50'
                    : isCompleted
                      ? 'border-green-200 bg-green-50'
                      : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isActive
                          ? 'bg-primary-500 text-white'
                          : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M16.704 5.29a1 1 0 00-1.408-1.419L7.825 11.35l-3.12-3.12a1 1 0 00-1.414 1.414l3.827 3.828a1 1 0 001.414 0l7.172-7.172z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      stepNumber
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{step.title}</p>
                    <p className="text-xs text-gray-500">{step.description}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {!verification ? (
          <>
            <p className="text-gray-600">
              twdiw QR Code 有效 5 分鐘，請先開啟 moda 數位憑證皮夾或相容皮夾，掃描後回到本頁等待 30-60 秒即可同步狀態。
            </p>
            <ul className="list-disc space-y-1 pl-5 text-xs text-gray-500">
              <li>如在手機使用本頁，可直接使用 Deep Link 無須掃描</li>
              <li>若看到「系統底層未知錯誤」，通常是 QR 已過期，請重新產生</li>
            </ul>
            <button
              onClick={startVerification}
              disabled={loading}
              className="w-full rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
            >
              {loading ? '啟動中...' : '開始驗證'}
            </button>
          </>
        ) : (
          <>
            {verification.transactionId && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span>交易代碼:</span>
                <code className="rounded bg-gray-100 px-2 py-1 font-mono text-[11px] text-gray-700">
                  {verification.transactionId}
                </code>
                <button
                  onClick={() => handleCopy(verification.transactionId, 'tx')}
                  className="text-primary-600 hover:text-primary-700"
                >
                  {copiedField === 'tx' ? '已複製' : '複製'}
                </button>
              </div>
            )}

            <div className="space-y-4">
              {verification.qrCodeUrl && (
                <div className="rounded-lg border border-gray-200 p-4 text-center">
                  <p className="text-sm text-gray-600 mb-3">請使用皮夾 APP 掃描 QR Code</p>
                  <img
                    src={verification.qrCodeUrl}
                    alt="VC Verification QR Code"
                    className="mx-auto h-48 w-48 rounded-lg border object-contain"
                  />
                  <p className="mt-3 text-xs text-gray-500">QR Code 5 分鐘失效，過期請重新啟動流程。</p>
                </div>
              )}

              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm font-medium text-blue-900 mb-2">無法掃描？改用 Deep Link</p>
                {verification.authUri ? (
                  <>
                    <a
                      href={verification.authUri}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      在皮夾中開啟驗證
                    </a>
                    <button
                      onClick={() => handleCopy(verification.authUri!, 'auth')}
                      className="mt-2 text-xs text-blue-800 underline-offset-2 hover:underline"
                    >
                      {copiedField === 'auth' ? 'Deep Link 已複製' : '複製 Deep Link'}
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-blue-800">
                    等候 twdiw 回傳 Deep Link。若 10 秒後仍未顯示，請重新啟動流程。
                  </p>
                )}
                <p className="mt-3 text-xs text-blue-900">
                  完成皮夾驗證後，系統會自動檢測並更新狀態。
                </p>
              </div>
            </div>

            {verification.status === 'pending' && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 animate-spin text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>系統自動檢測驗證結果中...</span>
                </div>
                <p className="mt-2 text-xs">
                  請完成皮夾驗證流程，系統會自動更新狀態。如果超過 5 分鐘未完成，可重新產生 QR Code。
                </p>
                <div className="mt-3">
                  <button
                    onClick={resetVerification}
                    className="rounded bg-white px-3 py-1.5 text-sm text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-50"
                  >
                    重新產生 QR Code
                  </button>
                </div>
              </div>
            )}

            {verification.status === 'completed' && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center text-green-700">
                <svg className="mx-auto h-10 w-10 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-3 text-lg font-semibold text-green-900">皮夾驗證完成</h3>
                <p className="text-sm">
                  我們已收到 moda workflow 的結果。若介面尚未自動更新，請點擊下方按鈕重新載入會員資料。
                </p>
                
                {verification.extractedClaims && (
                  <div className="mt-4 rounded-lg border border-green-300 bg-green-100 p-3">
                    <h4 className="text-sm font-semibold text-green-900 mb-2">驗證結果</h4>
                    <div className="space-y-1 text-xs text-green-800">
                      <div className="flex justify-between">
                        <span>階級:</span>
                        <span className="font-medium">{getRankDisplayName(verification.extractedClaims.rank)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>DID:</span>
                        <span className="font-mono text-[10px] break-all">
                          {verification.extractedClaims.did}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  <button
                    onClick={async () => {
                      await refreshUser();
                      resetVerification();
                    }}
                    className="rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                  >
                    立即更新狀態
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3">
            <div className="flex items-start gap-2">
              <svg className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">驗證過程發生錯誤</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <div className="mt-2 text-xs text-red-600 space-y-1">
                  <p>• 若顯示「查詢逾時」，請確認已在皮夾中完成驗證流程</p>
                  <p>• 若顯示「QR 已過期」，請重新啟動驗證取得新的 QR Code</p>
                  <p>• 若持續失敗，請檢查網路連線或稍後再試</p>
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={resetVerification}
                className="rounded bg-red-100 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-200"
              >
                重新開始
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
