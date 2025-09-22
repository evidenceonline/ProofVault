'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FiDownload, FiPlay, FiShield, FiLock, FiCheck } from 'react-icons/fi'

const Hero = () => {
  const [typedText, setTypedText] = useState('')
  const [showCursor, setShowCursor] = useState(true)
  
  const terminalText = 'chrome://extensions -> Load ProofVault'

  useEffect(() => {
    let i = 0
    const timer = setInterval(() => {
      if (i < terminalText.length) {
        setTypedText(terminalText.slice(0, i + 1))
        i++
      } else {
        clearInterval(timer)
      }
    }, 100)

    const cursorTimer = setInterval(() => {
      setShowCursor(prev => !prev)
    }, 500)

    return () => {
      clearInterval(timer)
      clearInterval(cursorTimer)
    }
  }, [])

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <section className="pt-24 pb-16 bg-legal-texture relative overflow-hidden">
      {/* Subtle Legal Pattern Overlay */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50/30 via-transparent to-blue-50/20"></div>
      </div>
      <div className="container-max-width section-padding relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Content */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <div className="space-y-4">
              <div className="inline-flex items-center space-x-2 bg-primary-50 text-primary-700 px-3 py-1 rounded-full text-sm font-medium">
                <FiShield className="w-4 h-4" />
                <span>Tamper-Proof Evidence</span>
              </div>
              
              <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 leading-tight">
                Digital Evidence That
                <span className="block text-gradient">Can&rsquo;t Be Challenged</span>
              </h1>

              <p className="text-xl text-gray-600 leading-relaxed max-w-2xl">
                ProofVault is a Chrome extension that captures screenshots and web evidence,
                then secures them forever on the blockchain. When someone claims your evidence
                has been tampered with or altered, you have cryptographic proof it hasn&rsquo;t.
                Perfect for legal professionals who need unshakeable evidence.
              </p>
            </div>

            {/* Key Benefits */}
            <div className="space-y-3">
              {[
                'One-click screenshot capture from any website',
                'Automatic PDF generation with legal metadata',
                'Blockchain verification creates tamper-proof record',
                'Court-admissible evidence certificates'
              ].map((benefit, index) => (
                <motion.div
                  key={benefit}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
                  className="flex items-center space-x-3"
                >
                  <div className="w-5 h-5 bg-primary-100 rounded-full flex items-center justify-center">
                    <FiCheck className="w-3 h-3 text-primary-600" />
                  </div>
                  <span className="text-gray-700">{benefit}</span>
                </motion.div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="https://www.youtube.com/watch?v=4ldmq9X06jU"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary group"
              >
                <FiPlay className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform duration-200" />
                Watch Demo
              </a>
            </div>

          </motion.div>

          {/* Right Column - Terminal Demo */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative"
          >
            <div className="bg-gray-900 rounded-lg shadow-2xl overflow-hidden">
              {/* Terminal Header */}
              <div className="bg-gray-800 px-4 py-3 flex items-center space-x-2">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <span className="text-gray-400 text-sm ml-4">Terminal</span>
              </div>
              
              {/* Terminal Content */}
              <div className="p-6 space-y-4">
                <div className="text-green-400 font-mono text-sm">
                  <span className="text-gray-500">$ </span>
                  {typedText}
                  {showCursor && <span className="bg-green-400 text-green-400">|</span>}
                </div>
                
                <div className="text-gray-300 font-mono text-xs space-y-1">
                  <div className="text-green-400">✓ Extension ready to go</div>
                  <div className="text-green-400">✓ Connected to blockchain</div>
                  <div className="text-green-400">✓ Your evidence vault is secure</div>
                  <div className="text-blue-400">→ Click extension icon to start</div>
                </div>
              </div>
            </div>

            {/* Floating Cards */}
            <motion.div
              animate={{ 
                y: [0, -10, 0],
                rotate: [0, 1, 0]
              }}
              transition={{ 
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute -top-4 -right-4 bg-white rounded-lg shadow-lg p-4 border border-gray-200"
            >
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                  <FiShield className="w-4 h-4 text-primary-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">Screenshot Saved</div>
                  <div className="text-xs text-gray-500">Proof recorded forever</div>
                </div>
              </div>
            </motion.div>

            <motion.div
              animate={{ 
                y: [0, 10, 0],
                rotate: [0, -1, 0]
              }}
              transition={{ 
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1
              }}
              className="absolute -bottom-4 -left-4 bg-white rounded-lg shadow-lg p-4 border border-gray-200"
            >
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <FiCheck className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">PDF Ready</div>
                  <div className="text-xs text-gray-500">Court-ready format</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default Hero