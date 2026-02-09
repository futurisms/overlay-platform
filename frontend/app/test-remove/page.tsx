'use client';

import { useState, useEffect } from 'react';

export default function TestRemovePage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState('3cd2ae9b-4046-449c-aa3b-2f959cfe7191');
  const [userId, setUserId] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  function addLog(message: string) {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toISOString().substring(11, 23)}: ${message}`]);
  }

  async function testRemove() {
    if (!userId || !sessionId) {
      addLog('❌ Please enter both Session ID and User ID');
      return;
    }

    setIsRunning(true);
    setLogs([]);
    addLog('🧪 TEST STARTED');
    addLog('═'.repeat(60));

    addLog(`Session ID: ${sessionId}`);
    addLog(`User ID to remove: ${userId}`);
    addLog('');

    try {
      // Step 1: Check auth token
      addLog('STEP 1: Checking authentication');
      const token = localStorage.getItem('auth_token');
      addLog(`  Token exists: ${!!token}`);
      if (token) {
        addLog(`  Token length: ${token.length} chars`);
        addLog(`  Token prefix: ${token.substring(0, 20)}...`);
      } else {
        addLog('  ❌ NO AUTH TOKEN FOUND!');
        addLog('  You need to login first');
        setIsRunning(false);
        return;
      }
      addLog('');

      // Step 2: Construct URL
      addLog('STEP 2: Constructing request URL');
      const url = `http://localhost:3001/sessions/${sessionId}/participants/${userId}`;
      addLog(`  Full URL: ${url}`);
      addLog('');

      // Step 3: Make DELETE request
      addLog('STEP 3: Making DELETE request');
      addLog(`  Method: DELETE`);
      addLog(`  Headers: Authorization: ${token ? 'Bearer ***' : 'NONE'}`);
      addLog('  Sending request...');

      const startTime = Date.now();
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': token || '',
          'Content-Type': 'application/json'
        }
      });
      const endTime = Date.now();

      addLog(`  Request completed in ${endTime - startTime}ms`);
      addLog('');

      // Step 4: Analyze response
      addLog('STEP 4: Response analysis');
      addLog(`  Status: ${response.status} ${response.statusText}`);
      addLog(`  OK: ${response.ok}`);

      const headers: string[] = [];
      response.headers.forEach((value, key) => {
        headers.push(`${key}: ${value}`);
      });
      addLog(`  Response headers:`);
      headers.forEach(h => addLog(`    ${h}`));
      addLog('');

      // Step 5: Parse response body
      addLog('STEP 5: Parsing response body');
      const contentType = response.headers.get('content-type');
      addLog(`  Content-Type: ${contentType}`);

      let responseBody;
      let responseText = '';

      try {
        responseText = await response.text();
        addLog(`  Raw response: ${responseText}`);

        if (responseText) {
          responseBody = JSON.parse(responseText);
          addLog(`  Parsed JSON:`);
          addLog(`    ${JSON.stringify(responseBody, null, 2).split('\n').join('\n    ')}`);
        } else {
          addLog(`  Empty response body`);
        }
      } catch (e) {
        addLog(`  ⚠️  Could not parse as JSON`);
        addLog(`  Raw text: ${responseText}`);
      }
      addLog('');

      // Step 6: Verdict
      addLog('STEP 6: Test verdict');
      addLog('═'.repeat(60));

      if (response.ok) {
        addLog('✅ DELETE REQUEST SUCCEEDED!');
        addLog(`✅ Status: ${response.status}`);
        if (responseBody) {
          addLog(`✅ Response: ${JSON.stringify(responseBody)}`);
        }
        addLog('');
        addLog('🎉 The participant should be removed from the session');
        addLog('   Refresh the session page to verify');
      } else {
        addLog(`❌ DELETE REQUEST FAILED`);
        addLog(`❌ Status: ${response.status} ${response.statusText}`);

        if (response.status === 400) {
          addLog('❌ Bad Request - Path parsing issue?');
        } else if (response.status === 403) {
          addLog('❌ Forbidden - Not admin or insufficient permissions');
        } else if (response.status === 404) {
          addLog('❌ Not Found - Session or user not found');
        } else if (response.status === 500) {
          addLog('❌ Internal Server Error - Backend crashed');
        }

        if (responseBody) {
          addLog(`❌ Error message: ${responseBody.error || responseBody.message || 'Unknown'}`);
        }
      }

    } catch (error) {
      addLog('');
      addLog('❌ EXCEPTION CAUGHT');
      addLog('═'.repeat(60));
      addLog(`Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
      addLog(`Error message: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.stack) {
        addLog(`Stack trace:`);
        addLog(error.stack);
      }

      // Check for common network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        addLog('');
        addLog('💡 DIAGNOSIS: Network/Fetch error');
        addLog('   Possible causes:');
        addLog('   1. Proxy server not running on port 3001');
        addLog('   2. CORS issue');
        addLog('   3. Network connectivity problem');
        addLog('');
        addLog('🔧 Solution: Check if proxy-server.js is running');
        addLog('   Terminal: cd frontend && node proxy-server.js');
      }
    }

    addLog('');
    addLog('🧪 TEST COMPLETE');
    addLog('═'.repeat(60));
    setIsRunning(false);
  }

  async function fetchSessionParticipants() {
    if (!sessionId) return;

    addLog('🔍 Fetching session participants...');
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`http://localhost:3001/sessions/${sessionId}`, {
        headers: {
          'Authorization': token || '',
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.participants && data.participants.length > 0) {
          addLog(`✅ Found ${data.participants.length} participants:`);
          data.participants.forEach((p: any, i: number) => {
            addLog(`  ${i + 1}. ${p.first_name} ${p.last_name} (${p.email})`);
            addLog(`     User ID: ${p.user_id}`);
          });
          addLog('');
          addLog('Copy a user_id from above and paste it below');
        } else {
          addLog('⚠️  No participants found');
        }
      } else {
        addLog(`❌ Failed to fetch session: ${response.status}`);
      }
    } catch (error) {
      addLog(`❌ Error fetching participants: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">🧪 Remove Participant Test</h1>
        <p className="text-gray-600 mb-6">Systematic testing of DELETE /sessions/:id/participants/:userId</p>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Configuration</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Session ID</label>
              <input
                type="text"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 3cd2ae9b-4046-449c-aa3b-2f959cfe7191"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">User ID to Remove</label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Paste user_id here"
              />
              <button
                onClick={fetchSessionParticipants}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                📋 Fetch participants from session to get user IDs
              </button>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={testRemove}
              disabled={isRunning || !userId || !sessionId}
              className={`px-6 py-3 rounded-lg font-semibold ${
                isRunning || !userId || !sessionId
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isRunning ? '⏳ Running Test...' : '🚀 Run Test'}
            </button>

            <button
              onClick={() => setLogs([])}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-semibold"
            >
              🗑️ Clear Logs
            </button>
          </div>
        </div>

        <div className="bg-gray-900 text-green-400 rounded-lg shadow-lg p-6 font-mono text-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Test Logs</h2>
            <span className="text-xs text-gray-500">
              {logs.length} log entries
            </span>
          </div>

          <div className="space-y-1 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs yet. Click "Run Test" to start.</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="whitespace-pre-wrap break-all">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-6 bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Important Notes</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• You must be logged in as an admin</li>
            <li>• The proxy server must be running on port 3001</li>
            <li>• Don't remove yourself from the session</li>
            <li>• This test uses the actual API - changes are REAL</li>
          </ul>
        </div>

        <div className="mt-4 bg-blue-50 border-l-4 border-blue-400 p-4">
          <h3 className="font-semibold text-blue-800 mb-2">📖 Expected Results</h3>
          <p className="text-sm text-blue-700 mb-2">If everything works correctly, you should see:</p>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>✅ Status: 200 OK</li>
            <li>✅ Response: {JSON.stringify({success: true, message: "Participant access revoked"})}</li>
            <li>✅ "DELETE REQUEST SUCCEEDED!" message</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
