import React, { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Upload, Pause, Zap, Search, X, CheckSquare, Trash2, Layers, FolderArchive, FileArchive, Key } from 'lucide-react';
import { TaggedImage, AppSettings, FLUX_PROMPT } from './types';
import { generateCaption, translateToEnglish } from './services/gemini';
import { generateCaptionOpenAI, translateToEnglishOpenAI } from './services/openai';
import { fileToBase64, downloadTextFile, extractImagesFromZip, downloadAsZip } from './utils/fileHelpers';
import { ImageCard } from './components/ImageCard';
import { SettingsPanel } from './components/SettingsPanel';

// Helper to wait for a specified duration
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to ensure valid MIME type
const getSafeMimeType = (file: File): string => {
    if (file.type && file.type !== '') return file.type;
    
    const name = file.name.toLowerCase();
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.webp')) return 'image/webp';
    if (name.endsWith('.bmp')) return 'image/bmp';
    return 'image/jpeg'; // Default assumption
};

const DEFAULT_SETTINGS: AppSettings = {
    prefix: "swj-s5-dw, ",
    suffix: ", white background, vector line art style",
    customPrompt: FLUX_PROMPT,
    customApiKey: "",
    provider: 'gemini',
    openaiApiKey: "",
    openaiBaseUrl: "https://api.openai.com/v1",
    openaiModel: "gpt-4o",
    taggingMode: 'flux'
};

const App: React.FC = () => {
  // Load settings from localStorage or fallback to defaults
  const [settings, setSettings] = useState<AppSettings>(() => {
      try {
          const saved = localStorage.getItem('fluxTagSettings');
          if (saved) {
              const parsed = JSON.parse(saved);
              // Merge with default to ensure new fields (like taggingMode) exist if loading old data
              return { ...DEFAULT_SETTINGS, ...parsed };
          }
      } catch (e) {
          console.error("Failed to load settings", e);
      }
      return DEFAULT_SETTINGS;
  });

  const [images, setImages] = useState<TaggedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Save settings to localStorage whenever they change
  useEffect(() => {
      localStorage.setItem('fluxTagSettings', JSON.stringify(settings));
  }, [settings]);
  
  // Ref to control stopping the loop immediately
  const shouldStopRef = useRef(false);

  // --- File Handling ---

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const files: File[] = Array.from(e.target.files);
    let newImages: TaggedImage[] = [];

    // Handle Zip files vs Regular Images
    for (const file of files) {
        if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
            try {
                const extracted = await extractImagesFromZip(file);
                const zipImages = extracted.map(f => ({
                    id: uuidv4(),
                    file: f,
                    previewUrl: URL.createObjectURL(f),
                    caption: "",
                    captionZh: "",
                    status: 'idle' as const,
                    selected: false,
                }));
                newImages = [...newImages, ...zipImages];
            } catch (err) {
                console.error("Failed to unzip", err);
                alert(`无法解压文件 ${file.name}`);
            }
        } else if (file.type.startsWith('image/')) {
            newImages.push({
                id: uuidv4(),
                file,
                previewUrl: URL.createObjectURL(file),
                caption: "",
                captionZh: "",
                status: 'idle',
                selected: false,
            });
        }
    }

    setImages(prev => [...prev, ...newImages]);
    e.target.value = '';
  };

  // --- AI Processing ---

  const processQueue = async (targetImages: TaggedImage[]) => {
    if (isProcessing) return;
    setIsProcessing(true);
    shouldStopRef.current = false; // Reset stop flag

    const queue = targetImages.filter(img => img.status !== 'loading');
    
    // ADAPTIVE SETTINGS
    let concurrencyLimit = settings.provider === 'openai' ? 5 : 3; // OpenAI handles concurrency better usually
    let dispatchDelay = settings.provider === 'openai' ? 100 : 500; 

    // Track active promises to manage concurrency
    const activePromises: Promise<void>[] = [];

    // Inner function to process a single item with retries
    const processItemWithRetry = async (item: TaggedImage, attempt = 0): Promise<void> => {
        try {
            // Check if user stopped/deleted while we were waiting
            if (shouldStopRef.current) return;

            // Update UI to show we are working on this specific item
            setImages(prev => prev.map(img => 
                img.id === item.id 
                ? { ...img, status: 'loading', errorMessage: attempt > 0 ? `重试中 (${attempt}/10)...` : undefined } 
                : img
            ));

            const base64 = await fileToBase64(item.file);
            const mimeType = getSafeMimeType(item.file);

            let result;
            if (settings.provider === 'openai') {
                 result = await generateCaptionOpenAI(
                    base64, 
                    mimeType, 
                    settings.customPrompt, 
                    settings.openaiApiKey, 
                    settings.openaiBaseUrl, 
                    settings.openaiModel
                 );
            } else {
                 result = await generateCaption(
                    base64, 
                    mimeType, 
                    settings.customPrompt, 
                    settings.customApiKey
                 );
            }
            
            if (shouldStopRef.current) return;

            setImages(prev => prev.map(img => 
                img.id === item.id 
                ? { ...img, status: 'success', caption: result.en.trim(), captionZh: result.zh.trim(), errorMessage: undefined } 
                : img
            ));
        } catch (error: any) {
             if (shouldStopRef.current) return;

             // Robust error detection
             const errString = JSON.stringify(error, Object.getOwnPropertyNames(error));
             const isRateLimit = 
                 error.status === 429 || 
                 errString.includes('429') || 
                 errString.includes('RESOURCE_EXHAUSTED') ||
                 errString.includes('quota');
             
             const isRetryable = isRateLimit || errString.includes('503') || errString.includes('fetch') || errString.includes('network');
             const MAX_RETRIES = 10;

             if (isRetryable && attempt < MAX_RETRIES) {
                let delay = 3000 * Math.pow(1.5, attempt); 
                
                if (isRateLimit) {
                    // ADAPTIVE THROTTLING:
                    concurrencyLimit = 1; 
                    dispatchDelay = 8000; 
                    delay = 15000 + (Math.random() * 5000); 

                    setImages(prev => prev.map(img => 
                        img.id === item.id 
                        ? { ...img, status: 'loading', errorMessage: `配额保护中 (${Math.ceil(delay/1000)}s)...` } 
                        : img
                    ));
                } else {
                    setImages(prev => prev.map(img => 
                        img.id === item.id 
                        ? { ...img, status: 'loading', errorMessage: `网络重试 (${Math.ceil(delay/1000)}s)...` } 
                        : img
                    ));
                }

                await wait(delay);
                return processItemWithRetry(item, attempt + 1);
             }

             console.error(`Processing error for ${item.file.name}:`, error);
                
             let errorMsg = "生成失败";
             if (isRateLimit) errorMsg = "配额耗尽";
             else if (errString.includes('MIME')) errorMsg = "格式错误";
             else if (errString.includes('SAFETY')) errorMsg = "内容拦截";
             else if (settings.provider === 'openai' && !settings.openaiApiKey) errorMsg = "缺 API Key";

             setImages(prev => prev.map(img => 
                 img.id === item.id 
                 ? { ...img, status: 'error', errorMessage: errorMsg } 
                 : img
             ));
        }
    };

    // CONCURRENT QUEUE LOOP
    for (const item of queue) {
        // Check if we should stop before starting new work
        if (shouldStopRef.current) {
            break; 
        }

        // Wait if we have reached the CURRENT dynamic concurrency limit
        while (activePromises.length >= concurrencyLimit) {
            await Promise.race(activePromises);
        }

        // Double check after wait
        if (shouldStopRef.current) break;

        // Create the promise for this item
        const task = processItemWithRetry(item);
        
        // Add to active set
        activePromises.push(task);

        // Cleanup when done
        const removeTask = () => {
            const index = activePromises.indexOf(task);
            if (index > -1) {
                activePromises.splice(index, 1);
            }
        };
        task.then(removeTask).catch(removeTask);

        await wait(dispatchDelay); 
    }

    // Wait for the final batch to finish
    await Promise.all(activePromises);

    setIsProcessing(false);
  };

  const handleStartProcessing = () => {
    if (settings.provider === 'openai' && !settings.openaiApiKey) {
        alert("请先在设置中配置 OpenAI API Key");
        return;
    }

    const selectedImages = images.filter(img => img.selected);
    
    if (selectedImages.length > 0) {
        processQueue(selectedImages);
    } else {
        const pendingImages = images.filter(img => img.status === 'idle' || img.status === 'error');
        processQueue(pendingImages);
    }
  };

  const handleStopProcessing = () => {
      shouldStopRef.current = true;
      setIsProcessing(false);
  };

  const handleRegenerate = async (id: string) => {
    const item = images.find(img => img.id === id);
    if (!item) return;
    
    processQueue([item]);
  };

  const handleTranslateZhToEn = async (id: string, zhText: string) => {
      setImages(prev => prev.map(img => img.id === id ? { ...img, status: 'translating', captionZh: zhText } : img));
      
      try {
          let enText = "";
          if (settings.provider === 'openai') {
               enText = await translateToEnglishOpenAI(
                  zhText, 
                  settings.openaiApiKey, 
                  settings.openaiBaseUrl, 
                  settings.openaiModel
               );
          } else {
               enText = await translateToEnglish(zhText, settings.customApiKey);
          }
          
          setImages(prev => prev.map(img => 
              img.id === id ? { ...img, status: 'success', caption: enText.trim() } : img
          ));
      } catch (e) {
          setImages(prev => prev.map(img => img.id === id ? { ...img, status: 'error', errorMessage: "同步失败" } : img));
      }
  };

  const handleApiKeySelect = async () => {
      if ((window as any).aistudio) {
          try {
              await (window as any).aistudio.openSelectKey();
              alert("API Key 已更新！后续任务将使用您选择的 Key。");
          } catch (e) {
              console.error("Key selection failed", e);
          }
      } else {
          alert("此环境不支持动态选择 API Key，请检查环境变量配置。");
      }
  };

  // --- CRUD Operations ---

  const handleUpdateCaption = (id: string, newCaption: string) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, caption: newCaption } : img));
  };

  const handleUpdateCaptionZh = (id: string, newCaptionZh: string) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, captionZh: newCaptionZh } : img));
  };

  const handleDelete = useCallback((id: string) => {
    // Stop processing if deleting just to be safe (though single delete usually doesn't need to stop queue, let's allow it)
    setImages(prev => {
        const item = prev.find(i => i.id === id);
        if (item) URL.revokeObjectURL(item.previewUrl);
        return prev.filter(i => i.id !== id);
    });
  }, []);

  // --- Batch Operations (Images) ---

  const handleToggleSelect = useCallback((id: string) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, selected: !img.selected } : img));
  }, []);

  const handleSelectAll = useCallback(() => {
      setImages(prev => {
          const allSelected = prev.length > 0 && prev.every(img => img.selected);
          return prev.map(img => ({ ...img, selected: !allSelected }));
      });
  }, []);

  const handleDeleteSelected = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      const count = images.filter(img => img.selected).length;
      if (count === 0) return;
      
      if (window.confirm(`确定要删除选中的 ${count} 张图片吗？`)) {
          shouldStopRef.current = true;
          setIsProcessing(false);
          
          setImages(currentImages => {
              const toKeep: TaggedImage[] = [];
              currentImages.forEach(img => {
                  if (img.selected) {
                      URL.revokeObjectURL(img.previewUrl);
                  } else {
                      toKeep.push(img);
                  }
              });
              return toKeep;
          });
      }
  }, [images]);

  const handleClearAll = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("确定要清空所有图片吗？")) {
        shouldStopRef.current = true;
        setIsProcessing(false);

        setImages(currentImages => {
            currentImages.forEach(img => URL.revokeObjectURL(img.previewUrl));
            return [];
        });
    }
  }, []);

  // --- Export ---

  const getFinalCaption = (rawCaption: string) => {
    const parts = [settings.prefix, rawCaption, settings.suffix];
    return parts.filter(p => p && p.trim().length > 0).join(" ");
  };

  const handleDownloadSingle = (item: TaggedImage) => {
    const content = getFinalCaption(item.caption);
    downloadTextFile(item.file.name, content);
  };

  const handleDownloadZip = () => {
    const filesToZip = images
        .filter(img => img.caption && img.caption.trim().length > 0)
        .map(img => ({
            filename: img.file.name,
            content: getFinalCaption(img.caption)
        }));

    if (filesToZip.length === 0) {
        alert("没有可下载的标注内容。请先进行打标。");
        return;
    }

    downloadAsZip(filesToZip);
  };

  // --- Render ---

  const idleCount = images.filter(i => i.status === 'idle').length;
  const errorCount = images.filter(i => i.status === 'error').length;
  const successCount = images.filter(i => i.status === 'success').length;
  const selectedCount = images.filter(i => i.selected).length;
  const allSelected = images.length > 0 && images.every(img => img.selected);

  // Progress Bar Calculation
  const processedCount = images.filter(i => i.status === 'success' || i.status === 'error').length;
  const progressPercentage = images.length > 0 ? Math.round((processedCount / images.length) * 100) : 0;

  const filteredImages = images.filter(img => 
    img.caption.toLowerCase().includes(searchTerm.toLowerCase()) ||
    img.captionZh.includes(searchTerm) ||
    img.file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Determine button state
  const buttonDisabled = (selectedCount === 0 && idleCount === 0 && errorCount === 0);
  const buttonText = selectedCount > 0 
        ? `极速打标选中图片 (${selectedCount})` 
        : `开始极速打标 (待处理: ${idleCount + errorCount})`;

  return (
    <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-20">
            <div className="max-w-[1600px] mx-4 md:mx-auto h-16 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                        <Layers className="text-white" size={20} />
                    </div>
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                        FluxTag
                    </h1>
                    <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded border border-gray-700">Turbo</span>
                </div>

                <div className="flex items-center space-x-4">
                    <div className="text-sm text-gray-400 hidden md:block">
                        {images.length} 个项目 <span className="mx-1">•</span> {successCount} 已完成
                    </div>
                    <button 
                        onClick={handleDownloadZip}
                        disabled={images.length === 0}
                        className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FileArchive size={16} />
                        <span>打包下载 (.zip)</span>
                    </button>
                </div>
            </div>
        </header>

        <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Sidebar */}
            <aside className="lg:col-span-3 space-y-6">
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-center">
                    <label className="cursor-pointer flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-600 rounded-lg hover:border-indigo-500 hover:bg-gray-750 transition-all">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="w-8 h-8 mb-3 text-gray-400" />
                            <p className="text-sm text-gray-400 text-center"><span className="font-semibold text-indigo-400">上传图片</span> 或 ZIP 压缩包</p>
                            <p className="text-xs text-gray-500 mt-1">支持拖拽上传</p>
                        </div>
                        <input 
                            type="file" 
                            className="hidden" 
                            multiple 
                            accept="image/*,.zip,application/zip" 
                            onChange={handleFileUpload} 
                        />
                    </label>
                </div>

                {images.length > 0 && (
                    <button
                        onClick={isProcessing ? handleStopProcessing : handleStartProcessing}
                        disabled={!isProcessing && buttonDisabled}
                        className={`w-full flex items-center justify-center space-x-2 py-3 rounded-xl text-base font-bold shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                        ${isProcessing 
                            ? "bg-amber-600 hover:bg-amber-500 shadow-amber-900/30 text-white"
                            : selectedCount > 0 
                                ? "bg-purple-600 hover:bg-purple-500 shadow-purple-900/30 text-white" 
                                : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/30 text-white"}`}
                    >
                        {isProcessing ? (
                            <>
                                <Pause size={20} fill="currentColor" />
                                <span>暂停处理</span>
                            </>
                        ) : (
                            <>
                                <Zap size={20} fill="currentColor" className="text-yellow-300" />
                                <span>{buttonText}</span>
                            </>
                        )}
                    </button>
                )}
                
                {/* API Authorization Section (Gemini Only) */}
                {settings.provider === 'gemini' && (
                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                        <div className="flex items-center space-x-2 text-indigo-400 mb-2">
                            <Key size={20} />
                            <h2 className="font-semibold text-sm">Gemini API 授权</h2>
                        </div>
                        <button
                            onClick={handleApiKeySelect}
                            className="w-full flex items-center justify-center space-x-2 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded transition-colors border border-gray-600"
                        >
                            <span>配置您的 API Key</span>
                        </button>
                        <div className="text-center mt-2">
                            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-[10px] text-gray-500 hover:text-indigo-400 underline">
                                查看计费和配额说明
                            </a>
                        </div>
                    </div>
                )}

                <SettingsPanel settings={settings} setSettings={setSettings} />
            </aside>

            {/* Main Content */}
            <section className="lg:col-span-9">

                {/* Progress Bar */}
                {images.length > 0 && (
                    <div className="mb-6 bg-gray-800 border border-gray-700 rounded-xl p-4 shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                                任务进度 (Progress)
                            </span>
                            <span className="text-xs font-mono text-indigo-300">
                                {progressPercentage}% ({processedCount}/{images.length})
                            </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-indigo-600 to-purple-500 transition-all duration-500 ease-out"
                                style={{ width: `${progressPercentage}%` }}
                            ></div>
                        </div>
                    </div>
                )}

                {images.length > 0 && (
                     <div className="mb-4 flex flex-col md:flex-row gap-4 items-center">
                        <div className="relative group flex-1 w-full">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-gray-500 group-focus-within:text-indigo-400" />
                            </div>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="block w-full pl-10 pr-10 py-3 border border-gray-700 rounded-xl leading-5 bg-gray-800 text-gray-300 placeholder-gray-500 focus:outline-none focus:bg-gray-900 focus:border-indigo-500 transition-colors sm:text-sm"
                                placeholder="查词：搜索文件名、中文或英文标注..."
                            />
                            {searchTerm && (
                                <button 
                                    onClick={() => setSearchTerm('')}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-white"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                        
                        <div className="flex space-x-2 shrink-0">
                            {selectedCount > 0 && (
                                <button 
                                    onClick={handleDeleteSelected}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20 rounded-xl text-sm font-medium transition-colors flex items-center space-x-2 whitespace-nowrap"
                                >
                                    <Trash2 size={16} />
                                    <span>删除 ({selectedCount})</span>
                                </button>
                            )}

                            <button 
                                onClick={handleSelectAll}
                                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center space-x-2 whitespace-nowrap"
                            >
                                <CheckSquare size={16} className={allSelected ? "text-indigo-500" : "text-gray-500"} />
                                <span>{allSelected ? '取消全选' : '全选'}</span>
                            </button>

                             <button 
                                onClick={handleClearAll}
                                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-red-400 hover:bg-red-900/30 hover:border-red-800 transition-colors flex items-center space-x-2 whitespace-nowrap"
                                title="清空所有图片"
                            >
                                <Trash2 size={16} />
                                <span className="hidden sm:inline">清空全部</span>
                            </button>
                        </div>
                    </div>
                )}

                {images.length === 0 ? (
                     <div className="h-[500px] flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-gray-800 rounded-xl bg-gray-900/50">
                        <div className="flex space-x-4 mb-4 opacity-30">
                            <Layers size={48} />
                            <FolderArchive size={48} />
                        </div>
                        <p className="text-lg font-medium">暂无图片</p>
                        <p className="text-sm">支持批量图片或 ZIP 压缩包上传</p>
                     </div>
                ) : (
                    <>
                        {filteredImages.length === 0 && searchTerm ? (
                            <div className="h-64 flex flex-col items-center justify-center text-gray-500 border border-gray-800 rounded-xl">
                                <Search size={32} className="mb-2 opacity-50" />
                                <p>没有找到包含 "{searchTerm}" 的图片</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {filteredImages.map(img => (
                                    <ImageCard 
                                        key={img.id} 
                                        item={img}
                                        onUpdateCaption={handleUpdateCaption}
                                        onUpdateCaptionZh={handleUpdateCaptionZh}
                                        onTranslateZhToEn={handleTranslateZhToEn}
                                        onDelete={handleDelete}
                                        onRegenerate={handleRegenerate}
                                        onDownload={handleDownloadSingle}
                                        onToggleSelect={handleToggleSelect}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </section>

        </main>
    </div>
  );
};

export default App;