interface SecurityTabProps {
  antiCheatingEnabled: boolean;
  setAntiCheatingEnabled: (value: boolean) => void;
}

export default function SecurityTab({
  antiCheatingEnabled,
  setAntiCheatingEnabled,
}: SecurityTabProps) {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
            <span className="text-xl">🔒</span>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">Security Settings</h2>
            <p className="text-sm text-gray-500">Exam security controls</p>
          </div>
        </div>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={antiCheatingEnabled}
              onChange={(e) => setAntiCheatingEnabled(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="font-medium text-gray-900">Enable Anti-Cheating Protection</span>
              <p className="text-xs text-gray-500">Monitor for suspicious activity during the exam</p>
            </div>
          </label>
          
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> Additional security features like fullscreen requirement, 
              copy/paste blocking, and tab switching detection will be implemented in a future update.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
