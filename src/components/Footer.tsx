import React, { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useUtmParams } from "@/hooks/useUtmParams";
import { scrollManager } from "@/utils/scrollManager";
import Logo from "@/components/Logo";

const Footer = React.memo(function Footer() {
  const location = useLocation();
  const { navigateWithUtms } = useUtmParams();

  const handlePageClick = useCallback((path: string) => {
    navigateWithUtms(path);
  }, [navigateWithUtms]);

  const handleSectionClick = useCallback((sectionId: string) => {
    if (location.pathname === '/') {
      scrollManager.scrollToElement(sectionId, 80, null);
    } else {
      navigateWithUtms(`/#${sectionId}`, { replace: false });
      setTimeout(() => {
        scrollManager.scrollToElement(sectionId, 80, null);
      }, 400);
    }
  }, [location.pathname, navigateWithUtms]);
  
  return (
    <footer className="bg-cream-200 pt-4 sm:pt-6 pb-12 sm:pb-16" role="contentinfo">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="text-center mb-8 flex justify-center">
          <Logo width={300} height={54} className="h-28 sm:h-32" />
        </div>

        {/* Description */}
        <p className="text-center text-brown-dark-300 text-sm sm:text-base max-w-2xl mx-auto mb-10">
          We create personalized songs, rooted in faith, to honor your loved ones and glorify the love of God through music.
        </p>

        {/* Links Grid */}
        <div className="flex flex-wrap justify-center gap-8 sm:gap-12 mb-10">
          {/* Contact */}
          <nav className="text-left" aria-labelledby="footer-contact">
            <h3 id="footer-contact" className="font-semibold text-brown-dark-400 mb-4 text-sm sm:text-base">
              Contact
            </h3>
            <ul className="space-y-2">
              <li>
                <a 
                  href="mailto:hello@thesongsurprise.com"
                  id="gtm-email-footer"
                  className="text-brown-dark-300 hover:text-terracotta-800 text-sm transition-colors gtm-link"
                >
                  hello@thesongsurprise.com
                </a>
              </li>
            </ul>
          </nav>

          {/* Useful */}
          <nav className="text-left" aria-labelledby="footer-useful">
            <h3 id="footer-useful" className="font-semibold text-brown-dark-400 mb-4 text-sm sm:text-base">
              Useful Links
            </h3>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => handlePageClick('/terms')}
                  className="text-brown-dark-300 hover:text-terracotta-800 text-sm transition-colors"
                  type="button"
                >
                  Terms of Service
                </button>
              </li>
              <li>
                <button
                  onClick={() => handlePageClick('/privacy')}
                  className="text-brown-dark-300 hover:text-terracotta-800 text-sm transition-colors"
                  type="button"
                >
                  Privacy Policy
                </button>
              </li>
            </ul>
          </nav>

          {/* Testimonials */}
          <nav className="text-left" aria-labelledby="footer-testimonials">
            <h3 id="footer-testimonials" className="font-semibold text-brown-dark-400 mb-4 text-sm sm:text-base">
              Testimonials
            </h3>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => handleSectionClick('testimonials')}
                  className="text-brown-dark-300 hover:text-terracotta-800 text-sm transition-colors"
                  type="button"
                >
                  View testimonials
                </button>
              </li>
            </ul>
          </nav>
        </div>

        {/* Divider */}
        <div className="border-t border-cream-300 pt-8">
          <p className="text-center text-brown-dark-300 text-xs sm:text-sm">
            © {new Date().getFullYear()} The Song Surprise. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
});

export default Footer;
