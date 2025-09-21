import React from 'react';
import { motion } from 'framer-motion';
import { HardHat } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const PlaceholderPage = ({ title }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex items-center justify-center h-full"
    >
      <Card className="w-full max-w-lg text-center shadow-lg">
        <CardHeader>
          <div className="mx-auto bg-yellow-100 p-4 rounded-full w-fit">
            <HardHat className="h-12 w-12 text-yellow-500" />
          </div>
          <CardTitle className="mt-4 text-2xl font-bold text-gray-800">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Modul ini sedang dalam tahap pengembangan.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Anda dapat meminta implementasi fitur ini pada prompt berikutnya! 🚀
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default PlaceholderPage;