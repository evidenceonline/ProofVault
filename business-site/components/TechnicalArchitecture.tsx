'use client'

import { motion } from 'framer-motion'
import {
  FiDatabase,
  FiCloud,
  FiLock,
  FiCode,
  FiServer,
  FiGitBranch,
  FiCpu,
  FiHardDrive
} from 'react-icons/fi'

const TechnicalArchitecture = () => {
  const architectureComponents = [
    {
      icon: FiCode,
      title: 'Chrome Extension',
      tech: 'Manifest V3, TypeScript',
      description: 'Modern browser extension with Content Security Policy compliance and secure DOM manipulation.',
      features: ['Service Worker background processing', 'Real-time screenshot capture', 'Metadata extraction', 'PDF generation']
    },
    {
      icon: FiServer,
      title: 'REST API Backend',
      tech: 'Node.js, Express.js',
      description: 'Scalable server architecture with comprehensive error handling and request validation.',
      features: ['PostgreSQL integration', 'Blockchain communication', 'File upload handling', 'Health monitoring']
    },
    {
      icon: FiDatabase,
      title: 'Database Layer',
      tech: 'PostgreSQL',
      description: 'ACID-compliant data storage with connection pooling and automated backup systems.',
      features: ['Encrypted PDF storage', 'Blockchain hash tracking', 'Audit trail logging', 'Performance optimization']
    },
    {
      icon: FiCloud,
      title: 'Blockchain Integration',
      tech: 'Constellation Network',
      description: 'HGTP protocol integration for immutable proof generation and verification.',
      features: ['Hash submission', 'Transaction verification', 'Consensus validation', 'Real-time status polling']
    },
    {
      icon: FiLock,
      title: 'Security Framework',
      tech: 'Multi-layer Protection',
      description: 'Enterprise-grade security with encryption, validation, and access control.',
      features: ['Data encryption at rest', 'CSP implementation', 'Input sanitization', 'Secure communication']
    },
    {
      icon: FiCpu,
      title: 'Process Management',
      tech: 'PM2 Ecosystem',
      description: 'Production-ready deployment with automatic restarts and monitoring.',
      features: ['Load balancing', 'Health checks', 'Error recovery', 'Performance metrics']
    }
  ]

  const techStack = [
    { category: 'Frontend', technologies: ['Next.js 15', 'TypeScript', 'Tailwind CSS', 'Framer Motion'] },
    { category: 'Backend', technologies: ['Node.js', 'Express.js', 'PostgreSQL', 'JWT Authentication'] },
    { category: 'Blockchain', technologies: ['Constellation Network', 'HGTP Protocol', 'Crypto Hashing', 'Verification APIs'] },
    { category: 'DevOps', technologies: ['PM2', 'Docker Ready', 'CI/CD Compatible', 'Health Monitoring'] }
  ]

  return (
    <section className="py-24 bg-gradient-to-b from-gray-50 to-white">
      <div className="container-max-width section-padding">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center space-y-4 mb-16"
        >
          <h2 className="text-3xl lg:text-5xl font-bold text-gray-900">
            Technical Architecture
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Built with modern technologies and enterprise-grade security.
            Every component designed for reliability, scalability, and legal compliance.
          </p>
        </motion.div>

        {/* Architecture Components */}
        <div className="grid lg:grid-cols-2 gap-8 mb-16">
          {architectureComponents.map((component, index) => (
            <motion.div
              key={component.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow duration-300"
            >
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <component.icon className="w-6 h-6 text-primary-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-xl font-bold text-gray-900">{component.title}</h3>
                    <span className="text-sm text-primary-600 font-medium">{component.tech}</span>
                  </div>
                  <p className="text-gray-600 mb-4">{component.description}</p>
                  <ul className="space-y-1">
                    {component.features.map((feature) => (
                      <li key={feature} className="text-sm text-gray-500 flex items-center">
                        <span className="w-1.5 h-1.5 bg-primary-600 rounded-full mr-2"></span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Tech Stack */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="bg-gray-900 rounded-2xl p-8 text-white"
        >
          <h3 className="text-2xl font-bold mb-8 text-center">Complete Technology Stack</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {techStack.map((stack) => (
              <div key={stack.category} className="space-y-4">
                <h4 className="font-semibold text-primary-400">{stack.category}</h4>
                <ul className="space-y-2">
                  {stack.technologies.map((tech) => (
                    <li key={tech} className="text-gray-300 text-sm">{tech}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Performance Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-16 grid md:grid-cols-3 gap-6"
        >
          {[
            { icon: FiHardDrive, metric: '<2s', description: 'Screenshot capture time' },
            { icon: FiDatabase, metric: '99.9%', description: 'System uptime guaranteed' },
            { icon: FiGitBranch, metric: '256-bit', description: 'Encryption strength' }
          ].map((stat, index) => (
            <div key={stat.description} className="text-center p-6 bg-white rounded-lg border border-gray-200">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <stat.icon className="w-6 h-6 text-primary-600" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-2">{stat.metric}</div>
              <div className="text-gray-600">{stat.description}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

export default TechnicalArchitecture