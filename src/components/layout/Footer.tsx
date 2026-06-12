import React from 'react'
import Link from 'next/link'
import { GitBranch, Github, Linkedin, Mail } from 'lucide-react'

export const Footer: React.FC = () => {
  return (
    <footer className="bg-muted/30 text-muted-foreground border-t border-border/50">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-primary rounded-lg">
                <GitBranch className="text-primary-foreground" size={24} />
              </div>
              <span className="text-xl font-heading font-bold text-foreground">
                Git<span className="text-gradient">Verse</span>
              </span>
            </Link>
            <p className="text-sm">
              Contribution made easy with repo visualization and PR Mentor.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Product</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/#features" className="hover:text-primary transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/#pricing" className="hover:text-primary transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="hover:text-primary transition-colors">
                  How it Works
                </Link>
              </li>
              <li>
                <span title="Coming soon" className="cursor-not-allowed opacity-50 hover:text-current">Documentation</span>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Company</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <span title="Coming soon" className="cursor-not-allowed opacity-50">About</span>
              </li>
              <li>
                <span title="Coming soon" className="cursor-not-allowed opacity-50">Blog</span>
              </li>
              <li>
                <span title="Coming soon" className="cursor-not-allowed opacity-50">Careers</span>
              </li>
              <li>
                <span title="Coming soon" className="cursor-not-allowed opacity-50">Contact</span>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <span title="Coming soon" className="cursor-not-allowed opacity-50 hover:text-current">Privacy Policy</span>
              </li>
              <li>
                <span title="Coming soon" className="cursor-not-allowed opacity-50 hover:text-current">Terms of Service</span>
                <Link href="/privacy-policy" className="hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms-of-service" className="hover:text-primary transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <span title="Coming soon" className="cursor-not-allowed opacity-50 hover:text-current">Security</span>
              </li>
              <li>
                <span title="Coming soon" className="cursor-not-allowed opacity-50 hover:text-current">Cookie Policy</span>
                <Link href="/cookie-policy" className="hover:text-primary transition-colors">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-12 pt-8 border-t border-border/50 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm">&copy; {new Date().getFullYear()} GitVerse. All rights reserved.</p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a
              href="https://x.com/nisshchayarathi"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X (formerly Twitter)"
              className="hover:text-primary transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a
              href="https://github.com/nisshchayarathi/gitverse-nextjs"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="hover:text-primary transition-colors"
            >
              <Github size={20} />
            </a>
            <a
              href="https://www.linkedin.com/in/nisshchayarathi"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="hover:text-primary transition-colors"
            >
              <Linkedin size={20} />
            </a>
            <a href="mailto:hello@gitverse.com" aria-label="Email" className="hover:text-primary transition-colors">
              <Mail size={20} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
