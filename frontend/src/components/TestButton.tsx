import React from 'react';

export function TestButton() {
  const handleClick = () => {
    alert('JavaScript 事件運作正常！');
    console.log('測試按鈕已點擊');
  };

  return (
    <button 
      onClick={handleClick}
      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
    >
      測試點擊事件
    </button>
  );
}
