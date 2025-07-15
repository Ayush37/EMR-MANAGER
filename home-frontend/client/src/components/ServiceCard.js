import React from 'react';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

const ServiceCard = ({ icon: Icon, title, description, link, color }) => {
  return (
    <a
      href={link}
      className="block bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105 p-6 border border-gray-200"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="h-8 w-8 text-white" />
        </div>
        <ArrowRightIcon className="h-5 w-5 text-gray-400" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </a>
  );
};

export default ServiceCard;