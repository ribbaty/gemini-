import React, { useState } from 'react';
import { AppSettings, FLUX_PROMPT, QWEN_PROMPT } from '../types';
import { Settings2, Wand2, Key, Eye, EyeOff, Server, Box, FileText, ScanText } from 'lucide-react';

interface SettingsPanelProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, setSettings }) => {
  const [showKey, setShowKey] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  
  const updateSetting = (key: keyof AppSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleModeChange = (mode: 'flux' | 'qwen') => {
      setSettings(prev => ({
          ...prev,
          taggingMode: mode,
          customPrompt: mode === 'flux' ? FLUX_PROMPT : QWEN_PROMPT
      }));
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-6 h-fit sticky top-4">
      <div className="flex items-center space-x-2 text-indigo-400 mb-4">
        <Settings2 size={20} />
        <h2 className="font-semibold">设置 (Configuration)</h2>
      </div>

      {/* Mode Selection */}
      <div className="space-y-3 pb-4 border-b border-gray-700">
         <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide flex items-center gap-1">
            <ScanText size={12} /> 打标模式 (Tagging Mode)
        </label>
        <div className="grid grid-cols-2 gap-2">
            <button
                onClick={() => handleModeChange('flux')}
                className={`flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-medium border transition-all
                ${settings.taggingMode === 'flux' 
                    ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/50' 
                    : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700'}`}
            >
                <FileText size={14} />
                <span>Flux 模式</span>
            </button>
            <button
                onClick={() => handleModeChange('qwen')}
                className={`flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-medium border transition-all
                ${settings.taggingMode === 'qwen' 
                    ? 'bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-900/50' 
                    : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700'}`}
            >
                <ScanText size={14} />
                <span>千问/OCR 模式</span>
            </button>
        </div>
        <p className="text-[10px] text-gray-500 px-1">
            {settings.taggingMode === 'flux' ? "专注形状、构图，去除风格描述 (适合 Flux)" : "专注文字识别(OCR)、客观细节 (适合 Qwen/通用)"}
        </p>
      </div>

      {/* Provider Selection */}
      <div className="space-y-3 pb-4 border-b border-gray-700">
        <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide flex items-center gap-1">
            <Server size={12} /> AI 服务提供商 (Provider)
        </label>
        <div className="grid grid-cols-2 gap-2">
            <button
                onClick={() => updateSetting('provider', 'gemini')}
                className={`flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-medium border transition-all
                ${settings.provider === 'gemini' 
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/50' 
                    : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700'}`}
            >
                <span>Google Gemini</span>
            </button>
            <button
                onClick={() => updateSetting('provider', 'openai')}
                className={`flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-medium border transition-all
                ${settings.provider === 'openai' 
                    ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/50' 
                    : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700'}`}
            >
                <span>OpenAI / GPT</span>
            </button>
        </div>
      </div>

      {/* Common Settings */}
      <div className="space-y-3">
        <div>
            <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">触发词 (前缀)</label>
            <input
            type="text"
            value={settings.prefix}
            onChange={(e) => updateSetting('prefix', e.target.value)}
            placeholder="例如：TOK style,"
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
        </div>
        
        <div>
            <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">后缀 (Suffix)</label>
            <input
            type="text"
            value={settings.suffix}
            onChange={(e) => updateSetting('suffix', e.target.value)}
            placeholder="例如：, high quality, 8k"
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
        </div>
      </div>

      <div className="border-t border-gray-700 pt-4">
         <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">系统提示词 (Prompt)</label>
            <button 
                onClick={() => handleModeChange(settings.taggingMode)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center"
                title="重置为当前模式的默认提示词"
            >
                <Wand2 size={10} className="mr-1" /> 重置
            </button>
         </div>
        <textarea
            value={settings.customPrompt}
            onChange={(e) => updateSetting('customPrompt', e.target.value)}
            rows={6}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs text-gray-300 focus:border-indigo-500 focus:outline-none leading-relaxed"
        />
      </div>

      {/* API Key Configuration Based on Provider */}
      <div className="border-t border-gray-700 pt-4">
        {settings.provider === 'gemini' ? (
            <>
                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide flex items-center gap-1">
                    <Key size={12} /> Gemini API Key (可选)
                </label>
                <div className="relative">
                    <input
                        type={showKey ? "text" : "password"}
                        value={settings.customApiKey || ''}
                        onChange={(e) => updateSetting('customApiKey', e.target.value)}
                        placeholder="在此粘贴您的 Key (AIza...)"
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-yellow-300 placeholder-gray-600 focus:border-yellow-500 focus:outline-none pr-8 font-mono"
                    />
                    <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-2 top-2.5 text-gray-500 hover:text-gray-300"
                    >
                        {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">留空则使用左侧按钮授权的 Key。</p>
            </>
        ) : (
            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide flex items-center gap-1">
                        <Key size={12} /> OpenAI API Key <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                        <input
                            type={showOpenAIKey ? "text" : "password"}
                            value={settings.openaiApiKey || ''}
                            onChange={(e) => updateSetting('openaiApiKey', e.target.value)}
                            placeholder="sk-..."
                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-emerald-300 placeholder-gray-600 focus:border-emerald-500 focus:outline-none pr-8 font-mono"
                        />
                        <button
                            type="button"
                            onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                            className="absolute right-2 top-2.5 text-gray-500 hover:text-gray-300"
                        >
                            {showOpenAIKey ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide flex items-center gap-1">
                        <Server size={12} /> 接口地址 (Base URL)
                    </label>
                    <input
                        type="text"
                        value={settings.openaiBaseUrl}
                        onChange={(e) => updateSetting('openaiBaseUrl', e.target.value)}
                        placeholder="https://api.openai.com/v1"
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-emerald-500 focus:outline-none font-mono"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide flex items-center gap-1">
                        <Box size={12} /> 模型名称 (Model)
                    </label>
                    <input
                        type="text"
                        value={settings.openaiModel}
                        onChange={(e) => updateSetting('openaiModel', e.target.value)}
                        placeholder="gpt-4o"
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-emerald-500 focus:outline-none font-mono"
                    />
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
