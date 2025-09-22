'use client'

import { motion } from 'framer-motion'
import { 
  FiShield, 
  FiLock, 
  FiClock, 
  FiFileText, 
  FiGlobe, 
  FiZap,
  FiDatabase,
  FiCheck,
  FiEye
} from 'react-icons/fi'

const Features = () => {
  const mainFeatures = [
    {
      icon: FiEye,
      title: 'Screenshot Any Website',
      description: 'Chrome extension captures full page screenshots with one click. Automatically records URL, timestamp, and browser information.',
      gradient: 'from-blue-500 to-blue-600'
    },
    {
      icon: FiFileText,
      title: 'Generate Evidence PDFs',
      description: 'Creates professional legal documents with all metadata, timestamps, and chain of custody information built in.',
      gradient: 'from-primary-500 to-primary-600'
    },
    {
      icon: FiShield,
      title: 'Blockchain Proof',
      description: 'Hash of your evidence is permanently stored on blockchain. Provides cryptographic proof that nothing has been altered.',
      gradient: 'from-green-500 to-green-600'
    }
  ]

  const additionalFeatures = [
    {
      icon: FiClock,
      title: 'Captures Everything Instantly',
      description: 'One click on the extension, screenshot saved. We grab all the metadata you might need later, even if you don\'t know you need it yet.'
    },
    {
      icon: FiGlobe,
      title: 'Works Everywhere',
      description: 'Chrome, Firefox, Edge, Safari - wherever you work, we\'re there. No compatibility headaches.'
    },
    {
      icon: FiZap,
      title: 'Doesn\'t Slow You Down',
      description: 'Takes screenshots faster than you can blink. Your workflow stays smooth, your evidence stays secure.'
    },
    {
      icon: FiDatabase,
      title: 'Never Loses Your Stuff',
      description: 'Local storage with blockchain backup. Your files stay on your device, but the proof lives forever.'
    },
    {
      icon: FiCheck,
      title: 'Built for Privacy',
      description: 'We don\'t store your data on our servers. Everything stays on your device until you decide to share it.'
    },
    {
      icon: FiEye,
      title: 'Perfect Paper Trail',
      description: 'Who took it, when, where, why - every detail tracked automatically. Chain of custody that holds up in court.'
    }
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6
      }
    }
  }

  return (
    <section id="features" className="py-24 bg-legal-grid">
      <div className="container-max-width section-padding">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center space-y-4 mb-16"
        >
          <h2 className="text-3xl lg:text-5xl font-bold text-gray-900">
            Core Features
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Simple Chrome extension that captures websites and creates blockchain-verified evidence.
            Built specifically to solve the &ldquo;this evidence has been tampered with&rdquo; problem.
          </p>
        </motion.div>

        {/* Main Features */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid lg:grid-cols-3 gap-8 mb-20 organic-grid"
        >
          {mainFeatures.map((feature, index) => (
            <motion.div
              key={feature.title}
              variants={itemVariants}
              className={`relative group ${index === 1 ? 'natural-offset' : index === 2 ? 'natural-offset-alt' : ''}`}
            >
              <div className="card card-hover h-full">
                {/* Icon with Gradient Background */}
                <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-gray-900">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </div>

                {/* Hover Effect Overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-transparent to-primary-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg pointer-events-none"></div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Additional Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 organic-grid-reverse"
        >
          {additionalFeatures.map((feature, index) => (
            <motion.div
              key={feature.title}
              variants={itemVariants}
              className={`rounded-lg p-6 border hover:border-primary-200 hover:shadow-lg transition-all duration-200 group card ${index % 3 === 1 ? 'organic-spacing' : index % 3 === 2 ? 'organic-spacing-alt' : ''}`}
            >
              <div className="flex items-start space-x-4">
                <div className="feature-icon group-hover:bg-primary-200 group-hover:text-primary-700 transition-colors duration-200">
                  <feature.icon className="w-5 h-5" />
                </div>
                <div className="space-y-2 flex-1">
                  <h3 className="font-semibold text-gray-900 group-hover:text-primary-900 transition-colors duration-200">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Real Security Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center space-x-8 rounded-lg px-8 py-4 shadow-sm border"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', borderColor: 'var(--border-warm)' }}>
            <div className="flex items-center space-x-2 text-gray-600">
              <FiShield className="w-5 h-5 text-primary-600" />
              <span className="text-sm font-medium">Local Storage</span>
            </div>
            <div className="w-px h-6 bg-gray-200"></div>
            <div className="flex items-center space-x-2 text-gray-600">
              <FiLock className="w-5 h-5 text-primary-600" />
              <span className="text-sm font-medium">No Data Collection</span>
            </div>
            <div className="w-px h-6 bg-gray-200"></div>
            <div className="flex items-center space-x-2 text-gray-600">
              <FiCheck className="w-5 h-5 text-primary-600" />
              <span className="text-sm font-medium">Blockchain Proof</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default Features