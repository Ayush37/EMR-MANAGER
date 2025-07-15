import React from 'react';
import './App.css';
import ServiceCard from './components/ServiceCard';
import { 
  ServerIcon, 
  DocumentTextIcon, 
  CircleStackIcon,
  CloudIcon
} from '@heroicons/react/24/outline';

function App() {
  const services = [
    {
      icon: ServerIcon,
      title: 'EMR Clusters',
      description: 'Manage Amazon EMR clusters across multiple environments. View cluster status, manage steps, and monitor job execution.',
      link: '/emr',
      color: 'bg-aws-blue'
    },
    {
      icon: DocumentTextIcon,
      title: 'SSM Parameters',
      description: 'Browse and manage AWS Systems Manager Parameter Store. Create, update, and view parameter values with version history.',
      link: '/parameters',
      color: 'bg-green-600'
    },
    {
      icon: CircleStackIcon,
      title: 'S3 Data Viewer',
      description: 'Browse S3 buckets and view parquet files directly in the browser. Navigate folders and preview data without downloads.',
      link: '/s3data',
      color: 'bg-purple-600'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-aws-squid shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <CloudIcon className="h-8 w-8 text-aws-smile mr-3" />
              <h1 className="text-2xl font-bold text-white">AWS Services Portal</h1>
            </div>
            <span className="text-sm text-gray-300 bg-aws-blue px-3 py-1 rounded-full">
              UAT Environment
            </span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-gradient-to-b from-aws-squid to-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-4">Welcome to AWS Services Portal</h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Centralized management interface for your AWS infrastructure. Access and manage EMR clusters, 
            SSM parameters, and S3 data all in one place.
          </p>
        </div>
      </div>

      {/* Services Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <ServiceCard
              key={index}
              icon={service.icon}
              title={service.title}
              description={service.description}
              link={service.link}
              color={service.color}
            />
          ))}
        </div>

        {/* Additional Information */}
        <div className="mt-16 bg-white rounded-lg shadow-md p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Getting Started</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Quick Access</h4>
              <p className="text-gray-600">
                Click on any service card above to navigate directly to the service interface.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Environment</h4>
              <p className="text-gray-600">
                You are currently accessing the UAT environment. All operations are performed in this environment.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Support</h4>
              <p className="text-gray-600">
                For assistance or to report issues, please contact your system administrator.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-100 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600">
            <p>AWS Services Portal - UAT Environment</p>
            <p className="text-sm mt-2">Powered by React and AWS</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;