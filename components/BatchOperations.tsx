import React, { useState } from 'react';
import { Replace, Eraser, Search } from 'lucide-react';

interface BatchOperationsProps {
  onBatchReplace: (find: string, replace: string) => void;
  disabled: boolean;
}

export const BatchOperations: React.FC<BatchOperationsProps> = ({ onBatchReplace, disabled }) => {
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');

  const handleReplace = () => {
    if (!findText) return;
    onBatchReplace(findText, replaceText);
  };

  const handleDelete = () => {
    if (!findText) return;
    onBatchReplace(findText, '');
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-4">
      <div className="flex items-center space-x-2 text-indigo-400 mb-2">
        <Replace size={20} />
        <h2 className="font-semibold">批量操作 (Batch Edit)</h2>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">查找 (Find)</label>
          <div className="relative">
             <input
              type="text"
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              placeholder="输入要查找的词..."
              disabled={disabled}
              className="w-full bg-gray-900 border border-gray-700 rounded pl-8 pr-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50"
            />
            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-500"/>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">替换为 (Replace with)</label>
          <input
            type="text"
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            placeholder="留空则删除..."
            disabled={disabled}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
             <button
                onClick={handleDelete}
                disabled={!findText || disabled}
                className="flex items-center justify-center space-x-1 px-3 py-2 bg-red-900/40 hover:bg-red-900/60 text-red-200 border border-red-900/50 rounded text-xs transition-colors disabled:opacity-50"
                title="从所有标注中删除该词"
             >
                <Eraser size={14} />
                <span>批量删除</span>
             </button>
             <button
                onClick={handleReplace}
                disabled={!findText || disabled}
                className="flex items-center justify-center space-x-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs transition-colors disabled:opacity-50"
                title="替换所有标注中的该词"
             >
                <Replace size={14} />
                <span>批量替换</span>
             </button>
        </div>
      </div>
    </div>
  );
};