'use client';

import { ValidationWarning } from '@/services/ingredientService';

interface ValidationResultsProps {
  valid: { name: string; validated: string }[];
  invalid: { name: string; warning: ValidationWarning }[];
  warnings: ValidationWarning[];
  onAcceptCorrection?: (original: string, corrected: string) => void;
  onRejectCorrection?: (original: string) => void;
  onRemoveInvalid?: (ingredient: string) => void;
}

export default function ValidationResults({
  valid,
  invalid,
  warnings,
  onAcceptCorrection,
  onRejectCorrection,
  onRemoveInvalid
}: ValidationResultsProps) {
  // Filter warnings to get only fuzzy match corrections
  const corrections = warnings.filter(w => w.original && w.corrected);
  const errors = warnings.filter(w => w.ingredient && !w.corrected);

  if (valid.length === 0 && invalid.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Valid ingredients */}
      {valid.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <svg className="h-5 w-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <h3 className="text-sm font-medium text-green-900">
              Nguyên liệu hợp lệ ({valid.length})
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {valid.map((item, index) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800"
              >
                {item.validated}
                {item.name !== item.validated && (
                  <span className="ml-1 text-xs text-green-600">
                    (từ &quot;{item.name}&quot;)
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Fuzzy match corrections */}
      {corrections.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <svg className="h-5 w-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <h3 className="text-sm font-medium text-yellow-900">
              Đề xuất sửa ({corrections.length})
            </h3>
            <div className="ml-auto text-xs text-yellow-700">
              Chọn &quot;Chấp nhận&quot; hoặc &quot;Bỏ qua&quot; cho từng đề xuất
            </div>
          </div>
          <div className="space-y-3">
            {corrections.map((warning, index) => (
              <div key={index} className="bg-white border-2 border-yellow-300 rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-base text-gray-600 line-through font-medium">
                        {warning.original}
                      </span>
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="text-base font-bold text-green-700">
                        {warning.corrected}
                      </span>
                    </div>
                    {warning.confidence && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                        {(warning.confidence * 100).toFixed(0)}% khớp
                      </span>
                    )}
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 mb-3">{warning.message}</p>
                
                {(onAcceptCorrection || onRejectCorrection) && (
                  <div className="flex items-center space-x-3">
                    {onAcceptCorrection && (
                      <button
                        onClick={() => onAcceptCorrection(warning.original!, warning.corrected!)}
                        className="flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                      >
                        <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Chấp nhận sửa
                      </button>
                    )}
                    {onRejectCorrection && (
                      <button
                        onClick={() => onRejectCorrection(warning.original!)}
                        className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                      >
                        <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Giữ nguyên
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invalid ingredients */}
      {invalid.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <svg className="h-5 w-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <h3 className="text-sm font-medium text-red-900">
              Nguyên liệu không hợp lệ ({invalid.length})
            </h3>
          </div>
          <div className="space-y-2">
            {invalid.map((item, index) => (
              <div key={index} className="bg-white border border-red-300 rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <span className="text-sm font-medium text-red-900">{item.name}</span>
                    <p className="text-xs text-red-700 mt-1">{item.warning.message}</p>
                    {item.warning.suggestions && item.warning.suggestions.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-600 mb-1">Gợi ý:</p>
                        <div className="flex flex-wrap gap-1">
                          {item.warning.suggestions.map((suggestion, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                            >
                              {suggestion}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {onRemoveInvalid && (
                    <button
                      onClick={() => onRemoveInvalid(item.name)}
                      className="ml-4 p-1 text-red-600 hover:bg-red-100 rounded"
                      title="Xóa"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* General errors */}
      {errors.length > 0 && errors.some(e => !invalid.find(inv => inv.name === e.ingredient)) && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <svg className="h-5 w-5 text-gray-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <h3 className="text-sm font-medium text-gray-900">Thông báo</h3>
          </div>
          <div className="space-y-1">
            {errors.map((error, index) => (
              <p key={index} className="text-sm text-gray-700">
                {error.message}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
