import React from 'react';

export function TestButton() {
  const handleClick = () => {
    alert('JavaScript events are working!');
    console.log('Test button clicked');
  };

  return (
    <button 
      onClick={handleClick}
      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
    >
      Test Click Event
    </button>
  );
}
