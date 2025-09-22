'use client'

import { motion } from 'framer-motion'
import { FiCamera, FiShield, FiDownload } from 'react-icons/fi'

const HowItWorks = () => {
  const steps = [
    {
      icon: FiCamera,
      title: 'One-Click Screenshot',
      description: 'See something you need to save? Click the ProofVault extension icon in your browser toolbar. We&apos;ll grab the screenshot plus all the technical details you might need later.',
      features: ['Works on any webpage', 'Captures everything automatically', 'Takes less than a second'],
      color: 'blue'
    },
    {
      icon: FiShield,
      title: 'Instant Blockchain Proof',
      description: 'The moment you take that screenshot, it gets recorded on the blockchain. Think of it like a digital notary that works instantly and never lies.',
      features: ['Happens automatically', 'Creates permanent proof', 'Can&apos;t be faked or altered'],
      color: 'primary'
    },
    {
      icon: FiDownload,
      title: 'Get Your Professional Report',
      description: 'Click "Generate Report" and get a clean PDF with your screenshot, all the technical details, and the blockchain proof. Ready to submit anywhere.',
      features: ['Professional-looking PDF', 'Includes blockchain certificate', 'Ready for court or clients'],
      color: 'green'
    }
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
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
    <section id="how-it-works" className="py-24 bg-warm-paper">
      <div className="container-max-width section-padding">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center space-y-4 mb-16"
        >
          <h2 className="text-3xl lg:text-5xl font-bold text-gray-900">
            It&apos;s Really This Simple
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Three clicks, and you&apos;ve got evidence that will hold up anywhere.
            We made it simple because evidence collection shouldn&apos;t be complicated.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="relative"
        >
          {/* Connection Lines */}
          <div className="hidden lg:block absolute top-24 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-200 via-primary-200 to-green-200 z-0"></div>

          <div className="grid lg:grid-cols-3 gap-8 relative z-10 organic-grid-reverse">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                variants={itemVariants}
                className={`relative ${index === 1 ? 'natural-offset' : ''}`}
              >
                {/* Step Number */}
                <div className="flex justify-center mb-6">
                  <div className={`
                    w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg
                    ${step.color === 'blue' ? 'bg-blue-500' : ''}
                    ${step.color === 'primary' ? 'bg-primary-500' : ''}
                    ${step.color === 'green' ? 'bg-green-500' : ''}
                    shadow-lg relative
                  `}>
                    <step.icon className="w-8 h-8" />
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center text-gray-900 text-sm font-bold shadow-md">
                      {index + 1}
                    </div>
                  </div>
                </div>

                {/* Card */}
                <div className="card card-hover text-center space-y-6">
                  <div className="space-y-3">
                    <h3 className="text-xl font-bold text-gray-900">{step.title}</h3>
                    <p className="text-gray-600">{step.description}</p>
                  </div>

                  {/* Features List */}
                  <div className="space-y-2">
                    {step.features.map((feature, featureIndex) => (
                      <div
                        key={featureIndex}
                        className="flex items-center justify-center space-x-2 text-sm text-gray-500"
                      >
                        <div className={`
                          w-1.5 h-1.5 rounded-full
                          ${step.color === 'blue' ? 'bg-blue-400' : ''}
                          ${step.color === 'primary' ? 'bg-primary-400' : ''}
                          ${step.color === 'green' ? 'bg-green-400' : ''}
                        `}></div>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Arrow for larger screens */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-24 -right-4 text-gray-300">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>

      </div>
    </section>
  )
}

export default HowItWorks