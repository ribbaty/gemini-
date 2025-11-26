import React, { useState, useCallback, useEffect } from 'react';
import { TaggedImage } from '../types';
import { Trash2, RefreshCw, Download, AlertCircle, Languages, ArrowLeftRight, CheckSquare, Square } from 'lucide-react';

interface ImageCardProps {
  item: TaggedImage;
  onUpdateCaption: (id: string, caption: string) => void;
  onUpdateCaptionZh: (id: string, captionZh: string) => void;
  onTranslateZhToEn: (id: string, zhText: string) => void;
  onDelete: (id: string) => void;
  onRegenerate: (id: string) => void;
  onDownload: (item: TaggedImage) => void;
  onToggleSelect: (id: string) => void;
}

export const ImageCard: React.FC<ImageCardProps> = ({
  item,
  onUpdateCaption,
  onUpdateCaptionZh,
  onTranslateZhToEn,
  onDelete,
  onRegenerate,
  onDownload,
  onToggleSelect
}) => {
  const [activeTab, setActiveTab] = useState<'en' | 'zh'>('en');
  // Local state to handle debounce or blur for translation
  const [localZh, setLocalZh] = useState(item.captionZh);

  useEffect(() => {
    setLocalZh(item.captionZh);
  }, [item.captionZh]);

  const handleChangeEn = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdateCaption(item.id, e.target.value);
  }, [item.id, onUpdateCaption]);

  const handleChangeZh = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalZh(e.target.value);
    onUpdateCaptionZh(item.id, e.target.value);
  }, [item.id, onUpdateCaptionZh]);

  // When leaving Chinese field, trigger translation if changed
  const handleBlurZh = useCallback(() => {
    if (localZh && localZh !== item.captionZh) {
         // Logic is handled by onUpdateCaptionZh update, but explicit translation trigger needed
    }
    // We actually want to let the user manually click "Sync" or just assume they want to keep active edits.
    // However, the request says "modify English in real time when modifying Chinese".
    // To save API, we do it onBlur.
    if (localZh && localZh.trim() !== "") {
        onTranslateZhToEn(item.id, localZh);
    }
  }, [item.id, localZh, onTranslateZhToEn]);

  const handleRegenerate = useCallback(() => {
    onRegenerate(item.id);
  }, [item.id, onRegenerate]);

  const handleDelete = useCallback(() => {
    onDelete(item.id);
  }, [item.id, onDelete]);
  
  const handleDownload = useCallback(() => {
    onDownload(item);
  }, [item, onDownload]);

  const handleToggleSelect = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect(item.id);
  }, [item.id, onToggleSelect]);

  return (
    <div className={`
        bg-gray-800 border rounded-lg overflow-hidden flex flex-col shadow-lg transition-all
        ${item.selected ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-700 hover:border-gray-600'}
    `}>
      <div className="relative h-48 bg-gray-900 group cursor-pointer" onClick={() => onToggleSelect(item.id)}>
        <img 
          src={item.previewUrl} 
          alt="preview" 
          className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" 
        />
        
        {/* Selection Checkbox */}
        <div className="absolute top-2 left-2 z-10">
            <div className={`p-1 rounded bg-black/40 backdrop-blur-sm transition-colors ${item.selected ? 'text-indigo-400' : 'text-gray-400 hover:text-white'}`}>
                {item.selected ? <CheckSquare size={20} fill="currentColor" className="text-indigo-500 bg-white/10" /> : <Square size={20} />}
            </div>
        </div>

        <div className="absolute top-2 right-2 flex space-x-1 z-10">
            <button 
              onClick={(e) => { e.stopPropagation(); handleDelete(); }}
              className="p-1.5 bg-black/60 text-red-400 rounded hover:bg-red-900/80 transition-colors backdrop-blur-sm"
              title="删除"
            >
              <Trash2 size={16} />
            </button>
        </div>

        {item.status === 'loading' && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm z-20">
                <RefreshCw className="animate-spin text-indigo-400" size={32} />
            </div>
        )}
        {item.status === 'translating' && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm z-20">
                <div className="flex flex-col items-center text-indigo-300">
                    <ArrowLeftRight className="animate-pulse mb-2" size={24} />
                    <span className="text-xs">同步英文中...</span>
                </div>
            </div>
        )}
        {item.status === 'error' && (
             <div className="absolute inset-0 bg-red-900/50 flex items-center justify-center backdrop-blur-sm p-4 z-20">
                <div className="text-center">
                    <AlertCircle className="mx-auto text-red-400 mb-2" size={24} />
                    <p className="text-xs text-red-200">{item.errorMessage || "失败"}</p>
                </div>
             </div>
        )}
      </div>
      
      <div className="p-3 flex-1 flex flex-col bg-gray-800">
        <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-400 truncate max-w-[120px]" title={item.file.name}>
                {item.file.name}
            </span>
            <div className="flex space-x-2">
                 <button 
                    onClick={() => setActiveTab('zh')}
                    className={`text-[10px] px-2 py-0.5 rounded transition-colors ${activeTab === 'zh' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                >
                    中文
                </button>
                <button 
                    onClick={() => setActiveTab('en')}
                    className={`text-[10px] px-2 py-0.5 rounded transition-colors ${activeTab === 'en' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                >
                    English
                </button>
                <div className="w-px h-4 bg-gray-700 mx-1"></div>
                <button 
                    onClick={handleRegenerate}
                    disabled={item.status === 'loading'}
                    className="text-xs text-indigo-300 hover:text-indigo-100 disabled:opacity-50"
                    title="重新生成"
                >
                    <RefreshCw size={14} />
                </button>
                 <button 
                    onClick={handleDownload}
                    className="text-xs text-emerald-300 hover:text-emerald-100"
                    title="下载 .txt"
                >
                    <Download size={14} />
                </button>
            </div>
        </div>

        <div className="flex-1 relative">
            {activeTab === 'en' ? (
                <textarea
                    className="w-full h-32 bg-gray-900 border border-gray-700 rounded p-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 resize-none font-sans leading-relaxed"
                    value={item.caption}
                    onChange={handleChangeEn}
                    placeholder={item.status === 'loading' ? "正在生成描述..." : "输入英文标注..."}
                    disabled={item.status === 'loading'}
                />
            ) : (
                <div className="relative h-32">
                    <textarea
                        className="w-full h-full bg-gray-900 border border-indigo-900/50 rounded p-2 text-sm text-indigo-100 focus:outline-none focus:border-indigo-500 resize-none font-sans leading-relaxed"
                        value={localZh}
                        onChange={handleChangeZh}
                        onBlur={handleBlurZh}
                        placeholder={item.status === 'loading' ? "正在翻译..." : "输入中文 (修改后自动同步英文)..."}
                        disabled={item.status === 'loading'}
                    />
                    <div className="absolute bottom-2 right-2 pointer-events-none">
                        <Languages size={14} className="text-indigo-500/50" />
                    </div>
                </div>
            )}
        </div>
        
        <div className="mt-1 flex justify-between items-center">
            <span className="text-[10px] text-gray-500">
                {activeTab === 'zh' ? '修改中文将自动更新英文' : 'Flux 最终使用英文'}
            </span>
            <span className="text-[10px] text-gray-500">
                {activeTab === 'en' ? item.caption.length : item.captionZh.length} 字符
            </span>
        </div>
      </div>
    </div>
  );
};