import React, { useEffect } from 'react';

export function TlkTest() {
  useEffect(() => {
    // Load tlk.io script
    const script = document.createElement('script');
    script.src = 'https://tlk.io/embed.js';
    script.async = true;
    document.head.appendChild(script);

    return () => {
      const existingScript = document.querySelector('script[src="https://tlk.io/embed.js"]');
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">tlk.io 測試</h2>
      
      {/* Simple test channel */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">簡單測試頻道 (短ID)</h3>
        <div 
          id="tlkio-test1" 
          data-channel="test-simple"
          data-theme="theme--minimal"
          data-nickname="測試用戶"
          style={{ width: '100%', height: '300px', border: '1px solid #ccc' }}
        />
      </div>

      {/* Test with our format */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">我們的格式測試 (短ID)</h3>
        <div 
          id="tlkio-test2" 
          data-channel="match-abc123"
          data-theme="theme--minimal"
          data-nickname="金牌會員"
          style={{ width: '100%', height: '300px', border: '1px solid #ccc' }}
        />
      </div>

      <div className="text-sm text-gray-600">
        <p>如果上面的聊天室都沒有載入，可能是 tlk.io 服務的問題</p>
      </div>
    </div>
  );
}
