'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiPlay,
  FiCheck,
  FiClock,
  FiShield,
  FiHash,
  FiLink,
  FiDownload,
  FiEye
} from 'react-icons/fi'

const BlockchainDemo = () => {
  const [demoStep, setDemoStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hash, setHash] = useState('')
  const [transactionId, setTransactionId] = useState('')

  const demoSteps = [
    {
      id: 0,
      title: 'Evidence Captured',
      description: 'Screenshot taken with metadata',
      icon: FiEye,
      status: 'completed',
      details: 'Timestamp: 2025-09-21 14:32:15 UTC\nURL: https://example.com/evidence\nBrowser: Chrome 131.0.0.0'
    },
    {
      id: 1,
      title: 'Hash Generated',
      description: 'Cryptographic fingerprint created',
      icon: FiHash,
      status: demoStep >= 1 ? 'completed' : 'pending',
      details: 'Algorithm: SHA-256\nHash: a7f5f35426b927411fc9231b56382173...\nFile size: 2.4 MB'
    },
    {
      id: 2,
      title: 'Blockchain Submission',
      description: 'Hash submitted to Constellation Network',
      icon: FiLink,
      status: demoStep >= 2 ? 'completed' : 'pending',
      details: 'Network: Constellation Testnet\nTransaction: 0x8f9e4b2a1c3d...\nConfirmations: Pending'
    },
    {
      id: 3,
      title: 'Verification Complete',
      description: 'Evidence permanently secured',
      icon: FiShield,
      status: demoStep >= 3 ? 'completed' : 'pending',
      details: 'Status: Verified\nBlock: 2,847,391\nConfirmations: 12'
    }
  ]

  useEffect(() => {
    if (isPlaying && demoStep < 3) {
      const timer = setTimeout(() => {
        setDemoStep(demoStep + 1)
        if (demoStep === 0) {
          setHash('a7f5f35426b927411fc9231b56382173c4b5f84dfe98f62e570b8f7b39a2b45e')
        }
        if (demoStep === 1) {
          setTransactionId('0x8f9e4b2a1c3d7e6f9b2a5c8d1e4f7a0b3c6d9e2f5a8b1c4d7e0f3a6b9c2d5e8f')
        }
      }, 2500)
      return () => clearTimeout(timer)
    }
    if (demoStep === 3) {
      setIsPlaying(false)
    }
  }, [isPlaying, demoStep])

  const startDemo = () => {
    setIsPlaying(true)
    setDemoStep(0)
    setHash('')
    setTransactionId('')
  }

  const resetDemo = () => {
    setIsPlaying(false)
    setDemoStep(0)
    setHash('')
    setTransactionId('')
  }

  return (
    <section className="py-24 bg-gradient-to-b from-white to-gray-50">
      <div className="container-max-width section-padding">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center space-y-4 mb-16"
        >
          <h2 className="text-3xl lg:text-5xl font-bold text-gray-900">
            How ProofVault Works
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            See how ProofVault creates tamper-proof records of your evidence.
            Complete workflow from capture to blockchain verification.
          </p>
        </motion.div>

        {/* Technical Architecture Diagram */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="bg-white rounded-lg shadow-lg p-8 border border-gray-200">
            <img
              src="/proofvault steps.jpg"
              alt="ProofVault Technical Architecture - Chrome Extension generates PDF, sends to Backend, saves to Database and Blockchain"
              className="w-full h-auto rounded-lg"
            />
          </div>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          {/* Demo Controls */}
          <div className="flex justify-center space-x-4 mb-12">
            <button
              onClick={startDemo}
              disabled={isPlaying}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiPlay className="w-5 h-5 mr-2" />
              {isPlaying ? 'Demo Running...' : 'Start Demo'}
            </button>
            <button
              onClick={resetDemo}
              className="btn-outline"
            >
              Reset
            </button>
          </div>

          {/* Demo Timeline */}
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-8 top-16 bottom-16 w-0.5 bg-gray-200"></div>
            <div
              className="absolute left-8 top-16 w-0.5 bg-primary-600 transition-all duration-1000 ease-out"
              style={{ height: `${(demoStep / 3) * 100}%` }}
            ></div>

            {/* Steps */}
            <div className="space-y-8">
              {demoSteps.map((step, index) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="relative flex items-start space-x-6"
                >
                  {/* Step Icon */}
                  <div className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${
                    step.status === 'completed'
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : isPlaying && demoStep === step.id
                        ? 'bg-primary-100 border-primary-300 text-primary-600 animate-pulse'
                        : 'bg-white border-gray-200 text-gray-400'
                  }`}>
                    {step.status === 'completed' ? (
                      <FiCheck className="w-8 h-8" />
                    ) : (
                      <step.icon className="w-8 h-8" />
                    )}
                  </div>

                  {/* Step Content */}
                  <div className="flex-1 min-h-[100px]">
                    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xl font-bold text-gray-900">{step.title}</h3>
                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                          step.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : isPlaying && demoStep === step.id
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-600'
                        }`}>
                          {step.status === 'completed' ? 'Complete' :
                           isPlaying && demoStep === step.id ? 'Processing...' : 'Pending'}
                        </div>
                      </div>
                      <p className="text-gray-600 mb-4">{step.description}</p>

                      {/* Technical Details */}
                      <div className="bg-gray-50 rounded p-4 font-mono text-sm">
                        <AnimatePresence>
                          {step.status === 'completed' || (isPlaying && demoStep === step.id) ? (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="space-y-1"
                            >
                              {step.details.split('\n').map((line, i) => (
                                <div key={i} className="text-gray-700">
                                  {line.includes('Hash:') && hash ? (
                                    <span>{line.replace('a7f5f35426b927411fc9231b56382173...', hash.slice(0, 32) + '...')}</span>
                                  ) : line.includes('Transaction:') && transactionId ? (
                                    <span>{line.replace('0x8f9e4b2a1c3d...', transactionId.slice(0, 18) + '...')}</span>
                                  ) : (
                                    line
                                  )}
                                </div>
                              ))}
                            </motion.div>
                          ) : (
                            <div className="text-gray-400">Waiting for previous step...</div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Results Panel */}
          <AnimatePresence>
            {demoStep === 3 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mt-12 bg-green-50 border border-green-200 rounded-lg p-8"
              >
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto">
                    <FiCheck className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-green-900">Evidence Secured!</h3>
                  <p className="text-green-800 max-w-2xl mx-auto">
                    Your evidence is now permanently secured on the blockchain with immutable proof of authenticity.
                    The verification certificate is ready for court presentation.
                  </p>
                  <div className="flex justify-center space-x-4 pt-4">
                    <button className="btn-primary bg-green-600 hover:bg-green-700">
                      <FiDownload className="w-5 h-5 mr-2" />
                      Download Certificate
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </section>
  )
}

export default BlockchainDemo