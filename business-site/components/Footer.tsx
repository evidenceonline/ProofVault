'use client'

import { FiShield, FiMail, FiTwitter, FiLinkedin, FiGithub } from 'react-icons/fi'

const Footer = () => {

  const scrollToSection = (href: string) => {
    if (href.startsWith('#')) {
      const element = document.querySelector(href)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }

  return (
    <footer className="bg-gray-900 text-white">
      <div className="container-max-width section-padding">
        {/* Main Footer Content */}
        <div className="py-16">
          {/* Brand Section */}
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center space-x-2">
              <img
                src="/proofvault-logo.jpg"
                alt="ProofVault Logo"
                className="w-12 h-12 object-contain"
              />
              <span className="text-xl font-bold">ProofVault</span>
            </div>

            <p className="text-gray-400 leading-relaxed max-w-md mx-auto">
              Secure evidence management with blockchain verification.
              Trusted by organizations worldwide for critical investigation documentation.
            </p>
          </div>
        </div>

      </div>
    </footer>
  )
}

export default Footer