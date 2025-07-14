import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import emrService from '../services/emrService';

const StepLogsModal = ({ cluster, step, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [totalLines, setTotalLines] = useState(0);
  const [containers, setContainers] = useState([]);
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [applicationId, setApplicationId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [logType, setLogType] = useState('step'); // 'step' or 'container'
  const [logFile, setLogFile] = useState('stderr'); // stderr, stdout, controller, syslog
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const logContainerRef = useRef(null);
  const loadedLines = useRef(0);
  const LINES_PER_LOAD = 1000;
  
  // Load initial logs and containers
  useEffect(() => {
    loadInitialData();
  }, [cluster.clusterId, step.id]);

  // Auto-refresh for running steps
  useEffect(() => {
    if (autoRefresh && step.state === 'RUNNING') {
      const interval = setInterval(() => {
        loadLogs(true);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, step.state]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Load step logs first
      await loadLogs();
      
      // Load containers list
      const containerData = await emrService.listStepContainers(cluster.clusterId, step.id);
      setContainers(containerData.containers || []);
      if (containerData.applicationId) {
        setApplicationId(containerData.applicationId);
      }
    } catch (error) {
      toast.error('Failed to load logs');
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = useCallback(async (refresh = false) => {
    try {
      const startLine = refresh ? 0 : loadedLines.current;
      const params = {
        type: logType,
        file: logFile,
        start: startLine,
        lines: LINES_PER_LOAD
      };
      
      if (logType === 'container' && selectedContainer) {
        params.container = selectedContainer.id;
        if (applicationId) {
          params.applicationId = applicationId;
        }
      }
      
      const response = await emrService.getStepLogs(cluster.clusterId, step.id, params);
      
      if (refresh) {
        setLogs(response.lines || []);
        loadedLines.current = response.lines?.length || 0;
      } else {
        setLogs(prev => [...prev, ...(response.lines || [])]);
        loadedLines.current += response.lines?.length || 0;
      }
      
      setTotalLines(response.totalLines || 0);
      setHasMore(response.hasMore || false);
      
      if (response.applicationId && !applicationId) {
        setApplicationId(response.applicationId);
      }
    } catch (error) {
      if (!refresh) {
        toast.error('Failed to load logs');
      }
    }
  }, [logType, logFile, selectedContainer, applicationId, cluster.clusterId, step.id]);

  const loadMoreLogs = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    try {
      await loadLogs();
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, logType, logFile, selectedContainer, applicationId]);

  // Virtual scrolling
  const handleScroll = useCallback(() => {
    if (!logContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    if (scrollHeight - scrollTop - clientHeight < 100 && hasMore && !loadingMore) {
      loadMoreLogs();
    }
  }, [hasMore, loadingMore, loadMoreLogs]);

  // Switch between step and container logs
  const switchToContainerLogs = (container) => {
    setSelectedContainer(container);
    setLogType('container');
    setLogFile('stdout');
    setLogs([]);
    loadedLines.current = 0;
    setHasMore(true);
    // Note: applicationId might be set after first load from step logs
    loadLogs();
  };

  const switchToStepLogs = () => {
    setLogType('step');
    setSelectedContainer(null);
    setLogs([]);
    loadedLines.current = 0;
    setHasMore(true);
    loadLogs();
  };

  const handleDownload = async () => {
    try {
      const params = {
        type: logType,
        file: logFile
      };
      
      if (logType === 'container' && selectedContainer) {
        params.container = selectedContainer.id;
        if (applicationId) {
          params.applicationId = applicationId;
        }
      }
      
      await emrService.downloadStepLogs(cluster.clusterId, step.id, params);
      toast.success('Log file downloaded');
    } catch (error) {
      toast.error('Failed to download logs');
    }
  };

  // Filter logs by search term
  const filteredLogs = searchTerm 
    ? logs.filter(line => line.toLowerCase().includes(searchTerm.toLowerCase()))
    : logs;

  // Highlight patterns
  const highlightLine = (line) => {
    if (!line) return '';
    
    // Highlight patterns
    const patterns = [
      { pattern: /ERROR/gi, class: 'text-red-600 font-semibold' },
      { pattern: /WARN/gi, class: 'text-yellow-600 font-semibold' },
      { pattern: /INFO/gi, class: 'text-blue-600' },
      { pattern: /DEBUG/gi, class: 'text-gray-600' },
      { pattern: /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/g, class: 'text-green-600' }
    ];
    
    let highlightedLine = line;
    patterns.forEach(({ pattern, class: className }) => {
      highlightedLine = highlightedLine.replace(pattern, (match) => 
        `<span class="${className}">${match}</span>`
      );
    });
    
    return highlightedLine;
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity z-50">
      <div className="fixed inset-0 z-50 overflow-hidden">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative transform overflow-hidden rounded-lg bg-white shadow-xl transition-all w-full max-w-7xl h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-white px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Step Logs: {step.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Step ID: {step.id} | Status: {step.state}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Controls */}
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
              <div className="flex flex-wrap items-center gap-4">
                {/* Log Type Tabs */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={switchToStepLogs}
                    className={`px-3 py-1 rounded-md text-sm font-medium ${
                      logType === 'step' 
                        ? 'bg-aws-blue text-white' 
                        : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Step Logs
                  </button>
                  {applicationId && (
                    <button
                      onClick={() => {
                        if (containers.length > 0) {
                          switchToContainerLogs(containers[0]);
                        } else {
                          setLogType('container');
                          setLogs(['Container logs are not yet available. They may still be uploading to S3.']);
                          loadedLines.current = 1;
                          setHasMore(false);
                        }
                      }}
                      className={`px-3 py-1 rounded-md text-sm font-medium ${
                        logType === 'container' 
                          ? 'bg-aws-blue text-white' 
                          : 'bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Container Logs
                    </button>
                  )}
                </div>

                {/* Container Selector */}
                {logType === 'container' && containers.length > 0 && (
                  <select
                    value={selectedContainer?.id || ''}
                    onChange={(e) => {
                      const container = containers.find(c => c.id === e.target.value);
                      if (container) switchToContainerLogs(container);
                    }}
                    className="rounded-md border-gray-300 text-sm"
                  >
                    {containers.map(container => (
                      <option key={container.id} value={container.id}>
                        {container.label}
                      </option>
                    ))}
                  </select>
                )}

                {/* Log File Selector */}
                <div className="flex items-center gap-2">
                  {logType === 'step' ? (
                    <>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="stderr"
                          checked={logFile === 'stderr'}
                          onChange={(e) => {
                            setLogFile(e.target.value);
                            setLogs([]);
                            loadedLines.current = 0;
                            loadLogs();
                          }}
                          className="mr-1"
                        />
                        <span className="text-sm">stderr</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="stdout"
                          checked={logFile === 'stdout'}
                          onChange={(e) => {
                            setLogFile(e.target.value);
                            setLogs([]);
                            loadedLines.current = 0;
                            loadLogs();
                          }}
                          className="mr-1"
                        />
                        <span className="text-sm">stdout</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="controller"
                          checked={logFile === 'controller'}
                          onChange={(e) => {
                            setLogFile(e.target.value);
                            setLogs([]);
                            loadedLines.current = 0;
                            loadLogs();
                          }}
                          className="mr-1"
                        />
                        <span className="text-sm">controller</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="syslog"
                          checked={logFile === 'syslog'}
                          onChange={(e) => {
                            setLogFile(e.target.value);
                            setLogs([]);
                            loadedLines.current = 0;
                            loadLogs();
                          }}
                          className="mr-1"
                        />
                        <span className="text-sm">syslog</span>
                      </label>
                    </>
                  ) : (
                    <>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="stdout"
                          checked={logFile === 'stdout'}
                          onChange={(e) => {
                            setLogFile(e.target.value);
                            setLogs([]);
                            loadedLines.current = 0;
                            loadLogs();
                          }}
                          className="mr-1"
                        />
                        <span className="text-sm">stdout</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="stderr"
                          checked={logFile === 'stderr'}
                          onChange={(e) => {
                            setLogFile(e.target.value);
                            setLogs([]);
                            loadedLines.current = 0;
                            loadLogs();
                          }}
                          className="mr-1"
                        />
                        <span className="text-sm">stderr</span>
                      </label>
                    </>
                  )}
                </div>

                {/* Search */}
                <div className="flex-1 max-w-xs">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search logs..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-3 py-1 border border-gray-300 rounded-md text-sm"
                    />
                    <svg
                      className="absolute left-3 top-1.5 h-4 w-4 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {step.state === 'RUNNING' && (
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={autoRefresh}
                        onChange={(e) => setAutoRefresh(e.target.checked)}
                        className="mr-1"
                      />
                      <span className="text-sm">Auto-refresh</span>
                    </label>
                  )}
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    Download
                  </button>
                </div>
              </div>

              {/* Info Bar */}
              <div className="mt-2 text-sm text-gray-600">
                {applicationId && (
                  <span className="mr-4">Application ID: <code className="font-mono">{applicationId}</code></span>
                )}
                <span>Lines: {loadedLines.current} / {totalLines}</span>
                {searchTerm && (
                  <span className="ml-4">Showing {filteredLogs.length} matching lines</span>
                )}
                {logType === 'container' && containers.length === 0 && applicationId && (
                  <button
                    onClick={async () => {
                      try {
                        const containerData = await emrService.listStepContainers(cluster.clusterId, step.id);
                        setContainers(containerData.containers || []);
                        if (containerData.containers && containerData.containers.length > 0) {
                          switchToContainerLogs(containerData.containers[0]);
                          toast.success('Container logs found!');
                        } else {
                          toast.info('Container logs not yet available');
                        }
                      } catch (error) {
                        toast.error('Failed to check for containers');
                      }
                    }}
                    className="ml-4 text-aws-blue hover:text-aws-blue-dark underline"
                  >
                    Check for containers
                  </button>
                )}
              </div>
            </div>

            {/* Log Content */}
            <div className="flex-1 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-aws-blue"></div>
                </div>
              ) : (
                <div
                  ref={logContainerRef}
                  onScroll={handleScroll}
                  className="h-full overflow-auto bg-gray-900 text-gray-100 p-4 font-mono text-sm"
                >
                  {filteredLogs.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      {searchTerm ? 'No matching lines found' : 'No log content available'}
                    </div>
                  ) : (
                    <>
                      {filteredLogs.map((line, index) => (
                        <div
                          key={index}
                          className="leading-relaxed hover:bg-gray-800 px-2 py-0.5 rounded"
                        >
                          <span className="text-gray-500 select-none mr-4">
                            {String(index + 1).padStart(6, ' ')}
                          </span>
                          <span dangerouslySetInnerHTML={{ __html: highlightLine(line) }} />
                        </div>
                      ))}
                      {loadingMore && (
                        <div className="text-center py-4">
                          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
                        </div>
                      )}
                      {!hasMore && logs.length > 0 && (
                        <div className="text-center text-gray-500 py-4">
                          End of log file
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StepLogsModal;