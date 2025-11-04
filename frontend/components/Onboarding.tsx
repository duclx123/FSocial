'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

interface OnboardingProps {
  onComplete: () => void;
}

const emojis = ['🍳', '🥗', '🍕', '🍰', '🥘', '🍜'];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if user has seen onboarding
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    
    if (!hasSeenOnboarding) {
      setShow(true);
    } else {
      onComplete();
    }
  }, [onComplete]);

  const handleGetStarted = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setShow(false);
    setTimeout(onComplete, 700); // Smooth transition out
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: 'easeInOut' }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-green-100 via-emerald-100 to-teal-100 overflow-hidden"
        >
          {/* Floating emojis background */}
          {emojis.map((emoji, index) => (
            <motion.div
              key={index}
              initial={{ 
                x: Math.random() * window.innerWidth,
                y: window.innerHeight + 100,
                scale: 0,
                rotate: 0
              }}
              animate={{
                y: -100,
                scale: [0, 1.5, 1],
                rotate: 360,
              }}
              transition={{
                duration: 8 + Math.random() * 4,
                delay: index * 0.3,
                repeat: Infinity,
                ease: 'linear'
              }}
              className="absolute text-6xl opacity-20 pointer-events-none"
              style={{
                left: `${(index / emojis.length) * 100}%`,
              }}
            >
              {emoji}
            </motion.div>
          ))}

          {/* Content */}
          <div className="relative z-10 max-w-2xl mx-auto px-6 text-center">
            {/* Welcome badge */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                delay: 0.3,
                type: 'spring',
                stiffness: 150,
                damping: 20
              }}
              className="inline-block mb-6"
            >
              <div className="bg-white/80 backdrop-blur-sm px-6 py-2 rounded-full shadow-lg border-2 border-green-200">
                <span className="text-green-600 font-semibold text-sm">✨ Welcome</span>
              </div>
            </motion.div>

            {/* Main heading with stagger */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.9 }}
            >
              <h1 className="text-6xl md:text-7xl font-extrabold mb-4">
                <motion.span
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 }}
                  className="block bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent"
                >
                  Welcome to
                </motion.span>
                <motion.span
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2 }}
                  className="block text-gray-800 mt-2"
                >
                  Mini Food Social
                </motion.span>
              </h1>
            </motion.div>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5 }}
              className="text-xl text-gray-600 mb-8 max-w-lg mx-auto"
            >
              Share recipes, connect with food lovers, and discover culinary inspiration
            </motion.p>

            {/* Feature highlights */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.8 }}
              className="grid grid-cols-3 gap-4 mb-10 max-w-xl mx-auto"
            >
              {[
                { icon: '📸', label: 'Share Recipes' },
                { icon: '👥', label: 'Connect' },
                { icon: '⭐', label: 'Discover' },
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ 
                    delay: 1.9 + index * 0.15,
                    type: 'spring',
                    stiffness: 180
                  }}
                  className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 shadow-md"
                >
                  <div className="text-3xl mb-2">{item.icon}</div>
                  <p className="text-sm font-medium text-gray-700">{item.label}</p>
                </motion.div>
              ))}
            </motion.div>

            {/* Get Started button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.4 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleGetStarted}
              className="px-10 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-lg font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden group"
            >
              <motion.div
                className="absolute inset-0 bg-white/20"
                initial={{ x: '-100%' }}
                whileHover={{ x: '100%' }}
                transition={{ duration: 0.5 }}
              />
              <span className="relative z-10 flex items-center gap-2">
                Get Started
                <motion.span
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  →
                </motion.span>
              </span>
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
