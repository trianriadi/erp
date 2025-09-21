import React from 'react';
    import { motion } from 'framer-motion';
    import { Button } from '@/components/ui/button';

    const EmptyState = ({ icon, title, description, actionText, onActionClick }) => {
      const IconComponent = icon;

      return (
        <motion.div
          className="text-center p-8 md:p-12 glass-effect rounded-lg border border-gray-200"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex justify-center items-center mb-4">
            <div className="bg-blue-100 p-4 rounded-full">
              <IconComponent className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          <p className="text-gray-500 mt-2 mb-6 max-w-md mx-auto">{description}</p>
          {actionText && onActionClick && (
            <Button onClick={onActionClick}>
              {actionText}
            </Button>
          )}
        </motion.div>
      );
    };

    export default EmptyState;