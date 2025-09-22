'use client'

import { motion } from 'framer-motion'
import {
  FiTrendingUp,
  FiShield,
  FiClock,
  FiAward,
  FiUsers,
  FiGlobe,
  FiCheck,
  FiArrowRight
} from 'react-icons/fi'

const CaseStudies = () => {
  const caseStudies = [
    {
      title: 'Fortune 500 IP Litigation',
      category: 'Intellectual Property',
      icon: FiShield,
      challenge: 'A major corporation needs to document trademark infringement across multiple jurisdictions with evidence that would hold up in international courts.',
      solution: 'With ProofVault, they could capture over 2,000 screenshots of infringing websites across 15 countries, each with blockchain verification and complete metadata.',
      results: [
        'Evidence could be accepted in all jurisdictions',
        'Could reduce discovery time by 60%',
        'No authenticity challenges possible from opposing counsel',
        'Stronger position for settlement negotiations'
      ],
      gradient: 'from-blue-500 to-purple-600'
    },
    {
      title: 'Employment Harassment Case',
      category: 'Employment Law',
      icon: FiUsers,
      challenge: 'A law firm needs to preserve rapidly-changing social media evidence of workplace harassment that could be deleted at any moment.',
      solution: 'Using ProofVault for real-time capture of social media posts, messages, and profiles with complete chain of custody documentation and timestamp verification.',
      results: [
        'All evidence could be preserved before deletion',
        'Chain of custody would never be questioned',
        'Stronger case positioning for plaintiff',
        'Could help establish precedent for social media evidence'
      ],
      gradient: 'from-green-500 to-teal-600'
    },
    {
      title: 'Regulatory Compliance Audit',
      category: 'Corporate Law',
      icon: FiGlobe,
      challenge: 'A multi-national corporation faces regulatory investigation requiring proof of compliance across different regulatory frameworks.',
      solution: 'With ProofVault for systematic documentation of compliance procedures, audit trails, and regulatory filings with immutable blockchain verification.',
      results: [
        'Regulatory investigation could conclude more favorably',
        'Compliance documentation would be unquestionable',
        'Could avoid potential penalties through solid evidence',
        'Would streamline future audit processes'
      ],
      gradient: 'from-orange-500 to-red-600'
    }
  ]


  return (
    <section className="py-24 bg-legal-grid">
      <div className="container-max-width section-padding">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center space-y-4 mb-16"
        >
          <h2 className="text-3xl lg:text-5xl font-bold text-gray-900">
            Hypothetical Case Scenarios
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Examples of how ProofVault could strengthen legal cases,
            improve efficiency, and address evidence authenticity concerns.
          </p>
        </motion.div>


        {/* Case Studies */}
        <div className="space-y-16">
          {caseStudies.map((caseStudy, index) => (
            <motion.div
              key={caseStudy.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`relative overflow-hidden rounded-2xl ${index % 2 === 0 ? 'lg:grid-cols-2' : 'lg:grid-cols-2'}`}
            >
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className={`h-2 bg-gradient-to-r ${caseStudy.gradient}`}></div>
                <div className="p-8">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center space-x-4">
                      <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${caseStudy.gradient} flex items-center justify-center`}>
                        <caseStudy.icon className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-1">{caseStudy.title}</h3>
                        <span className="text-primary-600 font-medium">{caseStudy.category}</span>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="grid lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div>
                        <h4 className="font-bold text-gray-900 mb-2">Challenge</h4>
                        <p className="text-gray-600 leading-relaxed">{caseStudy.challenge}</p>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 mb-2">ProofVault Solution</h4>
                        <p className="text-gray-600 leading-relaxed">{caseStudy.solution}</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-gray-900 mb-4">Results</h4>
                      <ul className="space-y-2">
                        {caseStudy.results.map((result, resultIndex) => (
                          <li key={resultIndex} className="flex items-center space-x-3">
                            <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <FiCheck className="w-3 h-3 text-green-600" />
                            </div>
                            <span className="text-gray-700">{result}</span>
                          </li>
                        ))}
                      </ul>

                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Testimonial Quote */}

      </div>
    </section>
  )
}

export default CaseStudies