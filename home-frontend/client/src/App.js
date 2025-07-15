import React, { useState, useEffect } from 'react';
import './App.css';
import { 
  ServerIcon, 
  DocumentTextIcon, 
  CircleStackIcon,
  CloudIcon,
  Bars3Icon,
  XMarkIcon,
  MoonIcon,
  SunIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  HomeIcon,
  Squares2X2Icon
} from '@heroicons/react/24/outline';

function App() {
  const [activeService, setActiveService] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(false);

  const services = [
    {
      id: 'emr',
      icon: ServerIcon,
      title: 'EMR Clusters',
      shortTitle: 'EMR',
      description: 'Manage Amazon EMR clusters across multiple environments',
      path: '/emr',
      color: 'text-aws-smile'
    },
    {
      id: 'ssm',
      icon: DocumentTextIcon,
      title: 'SSM Parameters',
      shortTitle: 'SSM',
      description: 'Browse and manage AWS Systems Manager Parameter Store',
      path: '/parameters',
      color: 'text-green-500'
    },
    {
      id: 's3data',
      icon: CircleStackIcon,
      title: 'S3 Data Viewer',
      shortTitle: 'S3 Data',
      description: 'Browse S3 buckets and view parquet files directly',
      path: '/s3data/',
      color: 'text-purple-500'
    }
  ];

  useEffect(() => {
    // Handle browser back/forward
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/') {
        setActiveService('dashboard');
      } else {
        const service = services.find(s => path.includes(s.id));
        if (service) {
          setActiveService(service.id);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    handlePopState(); // Set initial state

    // Apply dark mode class
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, [darkMode]);

  const handleServiceChange = (serviceId) => {
    setActiveService(serviceId);
    setIframeLoading(true);
    
    // Update URL without page reload
    if (serviceId === 'dashboard') {
      window.history.pushState({}, '', '/');
    } else {
      window.history.pushState({}, '', `/services/${serviceId}`);
    }
  };

  const handleIframeLoad = () => {
    setIframeLoading(false);
  };

  const currentService = services.find(s => s.id === activeService);

  return (
    <div className={`flex h-screen overflow-hidden ${darkMode ? 'dark' : ''}`}>
      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} transition-all duration-300 bg-aws-squid dark:bg-gray-900 border-r border-gray-700`}>
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : ''}`}>
              <CloudIcon className="h-8 w-8 text-aws-smile flex-shrink-0" />
              {!sidebarCollapsed && (
                <h1 className="ml-3 text-xl font-bold text-white">AWS-XCESS</h1>
              )}
            </div>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              {sidebarCollapsed ? <ChevronRightIcon className="h-5 w-5" /> : <ChevronLeftIcon className="h-5 w-5" />}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-1">
            {/* Dashboard */}
            <button
              onClick={() => handleServiceChange('dashboard')}
              className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeService === 'dashboard'
                  ? 'bg-aws-smile text-aws-squid'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <Squares2X2Icon className="h-5 w-5 flex-shrink-0" />
              {!sidebarCollapsed && <span className="ml-3">Dashboard</span>}
            </button>

            {/* Services */}
            <div className={`pt-4 ${!sidebarCollapsed ? 'border-t border-gray-700' : ''}`}>
              {!sidebarCollapsed && (
                <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Services
                </h3>
              )}
              {services.map((service) => (
                <button
                  key={service.id}
                  onClick={() => handleServiceChange(service.id)}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeService === service.id
                      ? 'bg-aws-smile text-aws-squid'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <service.icon className={`h-5 w-5 flex-shrink-0 ${activeService === service.id ? '' : service.color}`} />
                  {!sidebarCollapsed && <span className="ml-3">{service.title}</span>}
                </button>
              ))}
            </div>
          </nav>

          {/* Bottom Section */}
          <div className="px-2 py-4 border-t border-gray-700">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-300 rounded-md hover:bg-gray-700 hover:text-white transition-colors"
            >
              {darkMode ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
              {!sidebarCollapsed && <span className="ml-3">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-gray-100 dark:bg-gray-800">
        {/* Top Bar */}
        <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {activeService === 'dashboard' ? (
                  <>
                    <HomeIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Dashboard</h2>
                  </>
                ) : currentService ? (
                  <>
                    <currentService.icon className={`h-6 w-6 ${currentService.color}`} />
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{currentService.title}</h2>
                  </>
                ) : null}
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                  UAT Environment
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 relative overflow-hidden">
          {activeService === 'dashboard' ? (
            <div className="h-full overflow-auto p-6">
              <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Welcome to AWS-XCESS</h1>
                  <p className="text-lg text-gray-600 dark:text-gray-400">
                    Your unified portal for AWS service management
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {services.map((service) => (
                    <div
                      key={service.id}
                      onClick={() => handleServiceChange(service.id)}
                      className="bg-white dark:bg-gray-900 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer border border-gray-200 dark:border-gray-700 overflow-hidden"
                    >
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className={`p-3 rounded-lg bg-gray-100 dark:bg-gray-800`}>
                            <service.icon className={`h-8 w-8 ${service.color}`} />
                          </div>
                          <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                          {service.title}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                          {service.description}
                        </p>
                      </div>
                      <div className={`h-1 bg-gradient-to-r ${
                        service.id === 'emr' ? 'from-aws-smile to-aws-blue' :
                        service.id === 'ssm' ? 'from-green-500 to-green-600' :
                        'from-purple-500 to-purple-600'
                      }`}></div>
                    </div>
                  ))}
                </div>

                <div className="mt-12 bg-white dark:bg-gray-900 rounded-lg shadow-md p-8 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Platform Features</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Unified Interface</h4>
                      <p className="text-gray-600 dark:text-gray-400">
                        Access all your AWS services from a single, integrated platform without switching between tabs.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Real-time Management</h4>
                      <p className="text-gray-600 dark:text-gray-400">
                        Monitor and manage your EMR clusters, SSM parameters, and S3 data with live updates.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">AWS Integration</h4>
                      <p className="text-gray-600 dark:text-gray-400">
                        Built with AWS best practices and secure IAM role-based authentication.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {iframeLoading && (
                <div className="absolute inset-0 bg-white dark:bg-gray-900 flex items-center justify-center z-10">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-aws-smile mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading {currentService?.title}...</p>
                  </div>
                </div>
              )}
              <iframe
                src={currentService?.path}
                className="w-full h-full border-0"
                onLoad={handleIframeLoad}
                title={currentService?.title}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;