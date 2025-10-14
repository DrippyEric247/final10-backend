import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Upload } from 'lucide-react';

const CreateAuction = () => {
  return (
    <div className="min-h-screen bg-gray-900 pt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-3xl font-bold text-white mb-8">Create Auction</h1>
          <p className="text-gray-400 mb-8">Coming soon - Create your own auctions</p>
        </motion.div>
      </div>
    </div>
  );
};

export default CreateAuction;









































